import { expect, it } from 'vitest';
import { Urns } from '../../identifiers';
import { brokerBodyOf, brokerHeadersOf } from '../broker/brokerMessage';
import { runningConsumer } from '../broker/brokerQueueTesting';
import {
  invoke,
  recordedSomething,
  routesTo,
  something,
  temporaryStore,
  type Something,
} from '../broker/brokerQueueTesting';
import { describeBrokerQueues } from '../broker/queueSuite';
import { rabbitMQConfirmChannel } from './rabbitMQConfirmChannel';
import { rabbitMQConsumer } from './rabbitMQConsumer';
import { forwardToRabbitMQ } from './rabbitMQForwarder';
import {
  messageCountOf,
  messagesIn,
  sendRaw,
  startRabbitMQ,
} from './rabbitMQTesting';
import { deadLetterQueueOf, declareRabbitMQTopology } from './rabbitMQTopology';

const orderKey = Urns.routingKeyOf(Urns.of('ecommerce', 'order', 'o-1'));

describeBrokerQueues(
  'RabbitMQ',
  async () => {
    const rabbitMQ = await startRabbitMQ();
    const confirmChannel = rabbitMQConfirmChannel({
      connection: rabbitMQ.connection,
    });

    return {
      confirmChannel,
      connection: rabbitMQ.connection,
      declare: (...queues) =>
        declareRabbitMQTopology(rabbitMQ.connection, {
          channels: [...new Set(queues.map(({ channel }) => channel))],
          queues,
        }),
      consumersOf: (subscription, messageStore) => ({
        ...rabbitMQConsumer({
          connection: rabbitMQ.connection,
          subscription,
          messageStore,
        }),
        companions: [],
      }),
      send: (channel, key, referenceId = key) => {
        const message = something(referenceId);
        return sendRaw(confirmChannel, channel, {
          key,
          headers: brokerHeadersOf(message),
          body: brokerBodyOf(message.data),
        });
      },
      sendRaw: (channel, raw) => sendRaw(confirmChannel, channel, raw),
      forwarding: ({ channel, key, publishTimeoutInMs, retry, signal }) =>
        forwardToRabbitMQ<Something>({
          confirmChannel,
          publishTimeoutInMs,
          channels: [channel],
          routes: [routesTo(channel, key)],
          retry,
          signal,
        }),
      deadLetteredKeys: async (queue, count) => {
        for (let attempt = 0; attempt < 200; attempt++) {
          const messages = await messagesIn(
            rabbitMQ.connection,
            deadLetterQueueOf(queue),
          );
          if (messages.length >= count) return messages.map(({ key }) => key);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return [];
      },
      unsettled: ({ queue }) => messageCountOf(rabbitMQ.connection, queue),
      container: rabbitMQ.container,
      stop: async () => {
        await confirmChannel.close();
        await rabbitMQ.stop();
      },
    };
  },
  (broker, queueOfTest) => {
    it('manyCatchUpsOnOneConsumerLeaveNoListenersBehind', async () => {
      const subscription = queueOfTest();
      await broker().declare(subscription);
      const { store, dispose } = temporaryStore();
      const { consumer } = broker().consumersOf(subscription, store);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: () => undefined,
      });
      const warnings: string[] = [];
      const onWarning = (warning: Error) => warnings.push(warning.name);
      process.on('warning', onWarning);
      const { stop } = await runningConsumer(consumer);

      for (let wait = 0; wait < 12; wait++)
        await consumer.whenCaughtUp({ timeout: 10_000 });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await stop();
      await dispose();
      process.off('warning', onWarning);

      expect(warnings).not.toContain('MaxListenersExceededWarning');
    });

    it('aSendNoQueueCanReceiveToARequestsOrInternalChannelFails', async () => {
      const [requests, internal, responses] = [
        `${crypto.randomUUID()}-requests`,
        `${crypto.randomUUID()}-internal`,
        `${crypto.randomUUID()}-responses`,
      ];
      await declareRabbitMQTopology(broker().connection, {
        channels: [requests, internal, responses],
        queues: [],
      });

      const { store, dispose } = temporaryStore();
      const outcomes: string[] = [];
      for (const channel of [requests, internal, responses])
        outcomes.push(
          await invoke(
            broker().forwarding({
              channel,
              key: orderKey,
              publishTimeoutInMs: 5000,
              retry: { forever: false, retries: 0 },
            }),
            recordedSomething(something(orderKey)),
            store,
          ).then(
            () => 'sent',
            () => 'failed',
          ),
        );

      await dispose();

      expect(outcomes).toEqual(['failed', 'failed', 'sent']);
    });
  },
);
