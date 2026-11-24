import { expect, it } from 'vitest';
import { Urns } from '../../identifiers';
import { brokerBodyOf, brokerHeadersOf } from '../broker/brokerMessage';
import {
  routesTo,
  runningConsumer,
  something,
  temporaryStore,
  type Something,
} from '../broker/brokerQueueTesting';
import { describeBrokerQueues } from '../broker/queueSuite';
import { kafkaConsumer } from './kafkaConsumer';
import { kafkaDeadLetters } from './kafkaDeadLetters';
import { forwardToKafka } from './kafkaForwarder';
import { kafkaProducer, type KafkaProducer } from './kafkaProducer';
import { kafkaRoutingConsumer } from './kafkaRoutingConsumer';
import {
  committedOffsetsOf,
  endOffsetsOf,
  readTopic,
  sendRaw,
  startKafka,
} from './kafkaTesting';
import {
  deadLetterTopicOf,
  declareKafkaTopics,
  kafkaTopicOf,
} from './kafkaTopology';

const orderKey = Urns.routingKeyOf(Urns.of('ecommerce', 'order', 'o-1'));
const cartKey = Urns.routingKeyOf(Urns.of('ecommerce', 'cart', 'c-1'));

describeBrokerQueues(
  'Kafka',
  async () => {
    const kafka = await startKafka();
    const producer = kafkaProducer({ connection: kafka.connection });
    const producers: KafkaProducer[] = [];

    const send = (channel: string, key: string, referenceId = key) => {
      const message = something(referenceId);
      return sendRaw(producer, channel, {
        key,
        headers: brokerHeadersOf(message),
        body: brokerBodyOf(message.data),
      });
    };

    return {
      connection: kafka.connection,
      declare: (...queues) =>
        declareKafkaTopics(kafka.connection, {
          channels: [...new Set(queues.map(({ channel }) => channel))],
          queues,
        }),
      consumersOf: (subscription, messageStore) => {
        const deadLetters = kafkaDeadLetters({
          queue: subscription.queue,
          producer,
        });
        const options = {
          connection: kafka.connection,
          subscription,
          messageStore,
          deadLetters,
        };

        return {
          consumer: kafkaConsumer(options),
          deadLetters,
          companions:
            subscription.bindingKey === undefined ||
            subscription.bindingKey === '#'
              ? []
              : [kafkaRoutingConsumer({ ...options, producer })],
        };
      },
      send,
      sendRaw: (channel, raw) => sendRaw(producer, channel, raw),
      forwarding: ({ channel, key, publishTimeoutInMs, retry, signal }) => {
        const impatient = kafkaProducer({
          connection: kafka.connection,
          publishTimeoutInMs,
        });
        producers.push(impatient);

        return forwardToKafka<Something>({
          producer: impatient,
          channels: [channel],
          routes: [routesTo(channel, key)],
          retry,
          signal,
        });
      },
      deadLetteredKeys: async (queue, count) =>
        (
          await readTopic(kafka.connection, deadLetterTopicOf(queue), count)
        ).map(({ key }) => key),
      unsettled: async ({ channel, queue, bindingKey }) => {
        const topic = kafkaTopicOf({ channel, queue, bindingKey });
        const groupId = queue;
        return Number(
          (await endOffsetsOf(kafka.connection, topic)) -
            (await committedOffsetsOf(kafka.connection, groupId, topic)),
        );
      },
      container: kafka.container,
      stop: async () => {
        await Promise.all(producers.map((impatient) => impatient.close()));
        await producer.close();
        await kafka.stop();
      },
    };
  },
  (broker, queueOfTest) => {
    it('aNonHashPatternGetsItsOwnTopicFilledByARoutingConsumer', async () => {
      const subscription = queueOfTest('ecommerce.order.*');
      await broker().declare(subscription);
      const { store, dispose } = temporaryStore();
      const { companions } = broker().consumersOf(subscription, store);
      const started = await Promise.all(companions.map(runningConsumer));

      await broker().send(subscription.channel, orderKey);
      await broker().send(subscription.channel, cartKey);
      for (const routing of companions)
        await routing.whenCaughtUp({ timeout: 30_000 });
      for (const { stop } of started) await stop();
      await dispose();

      const { connection } = broker();
      const copied = await readTopic(connection, subscription.queue, 1);
      expect(kafkaTopicOf(subscription)).toBe(subscription.queue);
      expect(copied.map(({ key }) => key)).toEqual([orderKey]);
      expect(await endOffsetsOf(connection, subscription.queue)).toBe(1n);
    });
  },
);
