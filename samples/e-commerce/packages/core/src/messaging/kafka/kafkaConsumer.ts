import {
  delay,
  type AsyncRetryOptions,
  type EventStore,
  type ProcessorCheckpoint,
  subscriptionMessageSource,
} from '@event-driven-io/emmett';
import {
  Admin,
  Consumer,
  stringDeserializer,
  type Message as KafkaRecord,
} from '@platformatic/kafka';
import {
  decodeBrokerMessage,
  type AnyBrokerMessage,
  UnreadableMessageError,
  type BrokerMessageMetadata,
} from '../broker/brokerMessage';
import {
  brokerQueueConsumer,
  type BrokerSource,
  type BrokerQueueConsumer,
  type BrokerQueueConsumerOptions,
} from '../broker/brokerQueueConsumer';
import type { DeadLetters } from '../broker/deadLetters';
import { deliveryLedger } from '../broker/deliveryLedger';
import type { ChannelSubscription } from '../channels';
import { defaultKafkaClientId, type KafkaConnection } from './kafkaConnection';
import { kafkaPartitions, kafkaTopicOf } from './kafkaTopology';

type KafkaDelivery = {
  topic: string;
  partition: number;
  offset: bigint;
  commit: () => Promise<void>;
};

export type KafkaConsumerOptions = BrokerQueueConsumerOptions & {
  connection: KafkaConnection;
  subscription: ChannelSubscription;
  deadLetters: DeadLetters;
  resubscribe?: AsyncRetryOptions;
  catchUpTimeoutInMs?: number;
  sessionTimeoutInMs?: number;
  groupId?: string;
  topic?: string;
  messageStore: EventStore;
};

const partitionsOf = [...Array(kafkaPartitions).keys()];

const resubscribeDefaults: AsyncRetryOptions = {
  forever: true,
  minTimeout: 100,
  factor: 1.5,
  maxTimeout: 5000,
  shouldRetryResult: () => true,
};

export const kafkaConsumer = ({
  connection: { bootstrapBrokers, clientId = defaultKafkaClientId },
  subscription,
  deadLetters,
  resubscribe,
  catchUpTimeoutInMs = 30_000,
  sessionTimeoutInMs = 6000,
  groupId = subscription.queue,
  topic = kafkaTopicOf(subscription),
  messageStore,
  ...options
}: KafkaConsumerOptions): BrokerQueueConsumer => {
  const ledger = deliveryLedger<KafkaDelivery>({
    settle: async (settled) => {
      const highest = new Map<string, KafkaDelivery>();
      for (const delivery of settled) {
        const key = `${delivery.topic}:${delivery.partition}`;
        const current = highest.get(key);
        if (current === undefined || delivery.offset > current.offset)
          highest.set(key, delivery);
      }
      await Promise.all([...highest.values()].map((d) => d.commit()));
    },
  });

  const delivered = new Map<number, bigint>();
  const admin = new Admin({
    clientId: `${clientId}-offsets`,
    bootstrapBrokers,
  });

  const offsetsAt = async (timestamp: bigint) => {
    const listed = (
      await admin.listOffsets({
        topics: [
          {
            name: topic,
            partitions: partitionsOf.map((partitionIndex) => ({
              partitionIndex,
              timestamp,
            })),
          },
        ],
      })
    ).find((t) => t.name === topic);
    return new Map(
      (listed?.partitions ?? []).map((p) => [p.partitionIndex, p.offset]),
    );
  };

  const endOffsets = () => offsetsAt(-1n);
  const startOffsets = () => offsetsAt(-2n);

  const committedOffsets = async () => {
    const [group] = await admin.listConsumerGroupOffsets({
      groups: [
        { groupId, topics: [{ name: topic, partitionIndexes: partitionsOf }] },
      ],
    });
    const partitions = group?.topics.find((t) => t.name === topic)?.partitions;
    return new Map(
      (partitions ?? []).map((p) => [p.partitionIndex, p.committedOffset]),
    );
  };

  const pendingCount = async () => {
    const [end, committed, start] = await Promise.all([
      endOffsets(),
      committedOffsets(),
      startOffsets(),
    ]);

    return [...end].reduce((pending, [partition, endOffset]) => {
      const deliveredOffset = delivered.get(partition);
      const logStart = start.get(partition) ?? 0n;
      const committedOffset = committed.get(partition) ?? -1n;
      const next =
        deliveredOffset !== undefined
          ? deliveredOffset + 1n
          : committedOffset > logStart
            ? committedOffset
            : logStart;
      return endOffset > next ? pending + (endOffset - next) : pending;
    }, 0n);
  };

  let activeSignal: AbortSignal | undefined;
  let endPosition: Promise<ProcessorCheckpoint | null> | undefined;

  const endCheckpoint = () =>
    (endPosition ??= pendingCount().then(
      (pending) => ledger.checkpointAfter(pending),
      (error: unknown) => {
        endPosition = undefined;
        throw error;
      },
    ));

  const waitUntilEndOffsetsAreCommitted = async () => {
    const end = await endOffsets();
    const deadline = Date.now() + catchUpTimeoutInMs;

    for (;;) {
      const committed = await committedOffsets();
      if (
        [...end].every(
          ([partition, endOffset]) =>
            endOffset === 0n || (committed.get(partition) ?? 0n) >= endOffset,
        )
      )
        return;
      if (activeSignal === undefined || activeSignal.aborted) return;
      if (Date.now() > deadline)
        throw new Error(
          `The end offsets of '${topic}' were not committed by '${groupId}' within ${catchUpTimeoutInMs} ms`,
        );
      await delay(25);
    }
  };

  const source: BrokerSource = (canBeHandled) =>
    subscriptionMessageSource<AnyBrokerMessage, BrokerMessageMetadata>({
      resilience: { ...resubscribeDefaults, ...resubscribe },
      subscribe: async function* ({ signal }) {
        delivered.clear();
        endPosition = undefined;
        activeSignal = signal;
        const consumer = new Consumer({
          clientId: `${clientId}-${groupId}`,
          groupId,
          bootstrapBrokers,
          autocommit: false,
          deserializers: {
            key: stringDeserializer,
            headerKey: stringDeserializer,
            headerValue: stringDeserializer,
          },
        });
        const stream = await consumer.consume({
          topics: [topic],
          mode: 'committed',
          fallbackMode: 'earliest',
          autocommit: false,
          sessionTimeout: sessionTimeoutInMs,
          rebalanceTimeout: sessionTimeoutInMs,
          heartbeatInterval: Math.floor(sessionTimeoutInMs / 6),
        });
        const close = () => void stream.close();
        signal.addEventListener('abort', close);

        try {
          for await (const record of stream) {
            const delivery = deliveryOf(consumer, record);
            const checkpoint = ledger.deliver(delivery);
            delivered.set(record.partition, record.offset);

            const raw = {
              key: record.key,
              headers: Object.fromEntries(record.headers),
              body: record.value,
              position: record.offset,
              sequence: checkpoint,
              fallbackMessageId: `${record.topic}-${record.partition}-${record.offset}`,
            };

            let message;
            try {
              message = decodeBrokerMessage(raw, {
                channel: subscription.channel,
              });
            } catch (error) {
              if (!(error instanceof UnreadableMessageError)) throw error;

              await deadLetters.unreadable(raw, error.reason);
              await ledger.skip(checkpoint);
              continue;
            }

            if (!canBeHandled(message.type)) {
              await ledger.skip(checkpoint);
              continue;
            }

            ledger.handled(checkpoint);
            yield message;
          }
        } finally {
          signal.removeEventListener('abort', close);
          activeSignal = undefined;
          await stream.close();
          await consumer.close(true);
        }
      },
      readLastMessageCheckpoint:
        async (): Promise<ProcessorCheckpoint | null> => {
          if (activeSignal === undefined) return endCheckpoint();

          await waitUntilEndOffsetsAreCommitted();
          return ledger.lastHandledCheckpoint();
        },
      close: () => {
        activeSignal = undefined;
        return admin.close();
      },
    });

  const queueConsumer = brokerQueueConsumer({
    ...options,
    messageStore,
    source,
    ledger,
    endCheckpoint,
  });

  return queueConsumer;
};

const deliveryOf = (
  consumer: Consumer<string, Buffer, string, string>,
  record: KafkaRecord<string, Buffer, string, string>,
): KafkaDelivery => ({
  topic: record.topic,
  partition: record.partition,
  offset: record.offset,
  commit: async () => {
    if (consumer.isActive()) await record.commit();
  },
});
