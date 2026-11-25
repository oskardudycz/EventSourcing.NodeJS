import type { Meter } from '@event-driven-io/almanac';
import { otelMeter } from '@event-driven-io/almanac/otel';
import {
  boundedMessageQueue,
  subscriptionMessageSource,
  type AsyncRetryOptions,
  type ProcessorCheckpoint,
} from '@event-driven-io/emmett';
import { connect, type ConsumeMessage } from 'amqplib';
import {
  brokerHeaders,
  decodeBrokerMessage,
  unknownMessageType,
  UnreadableMessageError,
  type AnyBrokerMessage,
  type BrokerMessageHeaders,
  type BrokerMessageMetadata,
} from '../broker/brokerMessage';
import {
  brokerQueueConsumer,
  type BrokerQueueConsumer,
  type BrokerQueueConsumerOptions,
  type BrokerSource,
} from '../broker/brokerQueueConsumer';
import { countDeadLettered, type DeadLetters } from '../broker/deadLetters';
import { deliveryLedger } from '../broker/deliveryLedger';
import type { ChannelSubscription } from '../channels';
import { rabbitMQConfirmChannel } from './rabbitMQConfirmChannel';
import type { RabbitMQConnection } from './rabbitMQConnection';

type RabbitMQDelivery = {
  sequence: ProcessorCheckpoint | undefined;
  channelId: number;
  deadLettered: boolean;
  acknowledge: () => void;
  reject: () => void;
};

type Arrived = {
  message: ConsumeMessage;
  delivery: RabbitMQDelivery;
};

export type RabbitMQConsumerOptions = BrokerQueueConsumerOptions & {
  connection: RabbitMQConnection;
  subscription: ChannelSubscription;
  resubscribe?: AsyncRetryOptions;
  catchUpTimeoutInMs?: number;
  prefetch?: number;
  meter?: Meter;
};

export type RabbitMQQueueConsumer = {
  consumer: BrokerQueueConsumer;
  deadLetters: DeadLetters;
};

const resubscribeDefaults: AsyncRetryOptions = {
  forever: true,
  minTimeout: 100,
  factor: 1.5,
  maxTimeout: 5000,
  shouldRetryResult: () => true,
};

const headersOf = (message: ConsumeMessage): BrokerMessageHeaders =>
  Object.fromEntries(
    Object.entries(message.properties.headers ?? {}).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );

const catchUpProbeHeader = 'catch-up-probe';

let channelCounter = 0;

export const rabbitMQConsumer = ({
  connection: { url },
  subscription,
  resubscribe,
  catchUpTimeoutInMs = 30_000,
  prefetch = 100,
  meter = otelMeter(),
  messageStore,
  ...options
}: RabbitMQConsumerOptions): RabbitMQQueueConsumer => {
  const { queue, channel: exchange } = subscription;
  const awaiting = new Map<string, RabbitMQDelivery>();

  const ledger = deliveryLedger<RabbitMQDelivery>({
    settle: (settled) => {
      for (const delivery of settled) {
        if (delivery.sequence !== undefined) awaiting.delete(delivery.sequence);
        if (delivery.deadLettered) delivery.reject();
        else delivery.acknowledge();
      }
      return Promise.resolve();
    },
  });

  const deadLetters: DeadLetters = {
    failed: ({ type, metadata }) => {
      const delivery = awaiting.get(metadata.globalPosition);
      if (delivery !== undefined) {
        delivery.deadLettered = true;
        countDeadLettered(meter, queue, type);
      }
      return Promise.resolve();
    },
    unreadable: ({ headers, sequence }) => {
      const delivery = awaiting.get(sequence);
      if (delivery !== undefined) {
        delivery.deadLettered = true;
        countDeadLettered(
          meter,
          queue,
          headers[brokerHeaders.type] ?? unknownMessageType,
        );
      }
      return Promise.resolve();
    },
  };

  const readyCount = async () => {
    const model = await connect(url);
    model.on('error', () => undefined);
    try {
      const channel = await model.createChannel();
      return BigInt((await channel.checkQueue(queue)).messageCount);
    } finally {
      await model.close().catch(() => undefined);
    }
  };

  const probes = new Map<string, () => void>();
  let activeSignal: AbortSignal | undefined;
  const confirmChannel = rabbitMQConfirmChannel({ connection: { url } });

  const waitForProbe = async () => {
    const probeId = crypto.randomUUID();
    const seen = new Promise<void>((resolve) => probes.set(probeId, resolve));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onStopped: () => void = () => undefined;
    const stoppedSignal = activeSignal;

    try {
      const channel = await confirmChannel.current();
      channel.publish('', queue, Buffer.alloc(0), {
        headers: { [catchUpProbeHeader]: probeId },
      });
      await channel.waitForConfirms();

      await Promise.race([
        seen,
        new Promise<void>((resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `The catch-up probe of '${queue}' was not seen within ${catchUpTimeoutInMs} ms`,
                ),
              ),
            catchUpTimeoutInMs,
          );
          onStopped = resolve;
          if (stoppedSignal?.aborted) resolve();
          stoppedSignal?.addEventListener('abort', onStopped);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      stoppedSignal?.removeEventListener('abort', onStopped);
      probes.delete(probeId);
    }
  };

  const source: BrokerSource = (canBeHandled) =>
    subscriptionMessageSource<AnyBrokerMessage, BrokerMessageMetadata>({
      resilience: { ...resubscribeDefaults, ...resubscribe },
      subscribe: async function* ({ signal }) {
        activeSignal = signal;
        const model = await connect(url);
        const channelId = ++channelCounter;
        const arrivals = boundedMessageQueue<Arrived>({ capacity: prefetch });
        let open = true;
        const lost = (error?: Error) => {
          open = false;
          arrivals.fail(error ?? new Error('The RabbitMQ connection closed'));
        };
        model.on('error', lost);
        model.on('close', lost);

        try {
          const channel = await model.createChannel();
          channel.on('error', lost);
          await channel.prefetch(prefetch);
          await channel.consume(queue, (message) => {
            if (message === null) return;

            const delivery: RabbitMQDelivery = {
              sequence: undefined,
              channelId,
              deadLettered: false,
              acknowledge: () => {
                if (open) channel.ack(message);
              },
              reject: () => {
                if (open) channel.nack(message, false, false);
              },
            };
            const sequence = ledger.deliver(delivery);
            delivery.sequence = sequence;
            awaiting.set(sequence, delivery);
            void arrivals.push({ message, delivery });
          });

          for await (const { message, delivery } of arrivals.iterate(signal)) {
            if (delivery.sequence === undefined) continue;
            const sequence = delivery.sequence;
            const headers = headersOf(message);
            const probeId = headers[catchUpProbeHeader];
            if (probeId !== undefined) {
              await ledger.skip(sequence);
              probes.get(probeId)?.();
              continue;
            }

            const messageId: unknown = message.properties.messageId;
            const raw = {
              key: message.fields.routingKey || undefined,
              headers,
              body: message.content,
              position: BigInt(message.fields.deliveryTag),
              sequence,
              fallbackMessageId:
                typeof messageId === 'string' ? messageId : undefined,
            };

            let decoded;
            try {
              decoded = decodeBrokerMessage(raw, { channel: exchange });
            } catch (error) {
              if (!(error instanceof UnreadableMessageError)) throw error;

              await deadLetters.unreadable(raw, error.reason);
              await ledger.skip(sequence);
              continue;
            }

            if (!canBeHandled(decoded.type)) {
              await ledger.skip(sequence);
              continue;
            }

            ledger.handled(sequence);
            yield decoded;
          }
        } finally {
          activeSignal = undefined;
          open = false;
          await model.close().catch(() => undefined);
        }
      },
      readLastMessageCheckpoint:
        async (): Promise<ProcessorCheckpoint | null> => {
          if (activeSignal === undefined)
            return ledger.checkpointAfter(await readyCount());

          await waitForProbe();
          return ledger.lastHandledCheckpoint();
        },
      close: () => {
        activeSignal = undefined;
        return confirmChannel.close();
      },
    });

  const queueConsumer = brokerQueueConsumer({
    ...options,
    messageStore,
    source,
    ledger,
    endCheckpoint: async () => ledger.checkpointAfter(await readyCount()),
  });

  return { consumer: queueConsumer, deadLetters };
};
