import { delay, MessageProcessor } from '@event-driven-io/emmett';
import type { SQLiteEventStore } from '@event-driven-io/emmett-sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Urns } from '../../identifiers';
import {
  collectedCounters,
  until,
  type ContainerControl,
} from '../../testing/brokerTesting';
import { toWorkflowInbox, type ChannelSubscription } from '../channels';
import type { ForwardingHandler } from '../eventStoreForwarder';
import type { HandlerRetryOptions } from '../retryInHandler';
import { brokerHeaders } from './brokerMessage';
import type { BrokerQueueConsumer } from './brokerQueueConsumer';
import {
  failingInboxWriteEventStore,
  forwardingFromStore,
  inboxStreamOf,
  inboxWriterOf,
  invoke,
  recordedSomething,
  runningConsumer,
  something,
  temporaryStore,
  type Something,
} from './brokerQueueTesting';
import { deadLetteredCounter, type DeadLetters } from './deadLetters';
import { fromBrokerQueue } from './fromBrokerQueue';

export type RawSend = {
  key: string | undefined;
  headers: Record<string, string>;
  body: Buffer;
};

export type QueueConsumers = {
  consumer: BrokerQueueConsumer;
  deadLetters: DeadLetters;
  companions: BrokerQueueConsumer[];
};

export type QueueBroker = {
  declare(...queues: ChannelSubscription[]): Promise<void>;
  consumersOf(
    subscription: ChannelSubscription,
    messageStore: SQLiteEventStore,
  ): QueueConsumers;
  send(channel: string, key: string, referenceId?: string): Promise<void>;
  sendRaw(channel: string, raw: RawSend): Promise<void>;
  forwarding(
    options: {
      channel: string;
      key: string;
      publishTimeoutInMs: number;
    } & HandlerRetryOptions,
  ): ForwardingHandler<Something>;
  deadLetteredKeys(
    queue: string,
    count: number,
  ): Promise<(string | undefined)[]>;
  unsettled(subscription: ChannelSubscription): Promise<number>;
  container: ContainerControl;
  stop(): Promise<void>;
};

const counters = collectedCounters();

const orderKey = Urns.routingKeyOf(Urns.of('ecommerce', 'order', 'o-1'));
const cartKey = Urns.routingKeyOf(Urns.of('ecommerce', 'cart', 'c-1'));
const fastRetry = { retries: 2, minTimeout: 1, maxTimeout: 5 };

export const describeBrokerQueues = <Broker extends QueueBroker>(
  name: string,
  startBroker: () => Promise<Broker>,
  extras: (
    broker: () => Broker,
    queueOfTest: (bindingKey?: string) => ChannelSubscription,
  ) => void = () => undefined,
) =>
  describe(`${name} queues`, () => {
    let broker: Broker;
    const disposables: (() => Promise<void>)[] = [];

    beforeAll(async () => {
      broker = await startBroker();
    }, 180_000);

    afterAll(async () => {
      for (const dispose of disposables.reverse()) await dispose();
      await broker.stop();
    }, 60_000);

    const storeOfTest = () => {
      const { store, dispose } = temporaryStore();
      disposables.push(dispose);
      return store;
    };

    const queueOfTest = (bindingKey?: string): ChannelSubscription => ({
      channel: `channel-${crypto.randomUUID()}`,
      queue: `queue-${crypto.randomUUID()}`,
      bindingKey,
    });

    const consumersOf = (
      subscription: ChannelSubscription,
      messageStore: SQLiteEventStore = storeOfTest(),
    ) => broker.consumersOf(subscription, messageStore);

    const collecting = (consumer: BrokerQueueConsumer, processorId: string) => {
      const received: string[] = [];
      consumer.reactor({
        processorId,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: (message) => {
          received.push(message.metadata.key ?? '');
        },
      });
      return received;
    };

    const startAll = (consumers: QueueConsumers[]) =>
      Promise.all(
        consumers.flatMap(({ consumer, companions }) =>
          [...companions, consumer].map(runningConsumer),
        ),
      );

    it('topicPatternsDeliverToEachMatchingQueue', async () => {
      const channel = `channel-${crypto.randomUUID()}`;
      const queues: ChannelSubscription[] = [
        { channel, queue: `all-${crypto.randomUUID()}` },
        {
          channel,
          queue: `orders-${crypto.randomUUID()}`,
          bindingKey: 'ecommerce.order.*',
        },
        {
          channel,
          queue: `ecommerce-${crypto.randomUUID()}`,
          bindingKey: 'ecommerce.#',
        },
        {
          channel,
          queue: `elsewhere-${crypto.randomUUID()}`,
          bindingKey: 'other.*',
        },
      ];
      await broker.declare(...queues);

      const all = queues.map((subscription) => {
        const consumers = consumersOf(subscription);
        return {
          consumers,
          received: collecting(consumers.consumer, subscription.queue),
        };
      });
      const started = await startAll(all.map(({ consumers }) => consumers));
      await broker.send(channel, orderKey);
      await broker.send(channel, cartKey);
      for (const { consumers } of all) {
        for (const companion of consumers.companions)
          await companion.whenCaughtUp({ timeout: 30_000 });
        await consumers.consumer.whenCaughtUp({ timeout: 30_000 });
      }
      for (const { stop } of started) await stop();

      expect(all.map(({ received }) => [...received].sort())).toEqual([
        [cartKey, orderKey].sort(),
        [orderKey],
        [cartKey, orderKey].sort(),
        [],
      ]);
    });

    it('aSendWithoutAcknowledgementWithinTheTimeoutFailsWithinTheTimeoutAndIsRetried', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const failures: number[] = [];
      const forwarding = forwardingFromStore({
        store: storeOfTest(),
        channel: subscription.channel,
        forwarding: broker.forwarding({
          channel: subscription.channel,
          key: orderKey,
          publishTimeoutInMs: 500,
          retry: {
            minTimeout: 50,
            maxTimeout: 200,
            onRetry: () => failures.push(Date.now()),
          },
        }),
      });

      await broker.container.pause();
      const sentAt = Date.now();
      await forwarding.append(orderKey);
      await until(() => failures.length >= 2);
      await broker.container.unpause();
      await forwarding.caughtUp();
      await forwarding.stop();

      expect(failures[0]! - sentAt).toBeGreaterThanOrEqual(400);
      expect(failures[0]! - sentAt).toBeLessThan(1500);
      const consumers = consumersOf(subscription);
      const received = collecting(consumers.consumer, subscription.queue);
      const { stop } = (await startAll([consumers]))[0]!;
      await consumers.consumer.whenCaughtUp({ timeout: 30_000 });
      await stop();
      expect(new Set(received)).toEqual(new Set([orderKey]));
    });

    it('withTheBrokerDownTheForwarderRetriesAndSendsWhenItIsBack', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const failures: unknown[] = [];
      const forwarding = forwardingFromStore({
        store: storeOfTest(),
        channel: subscription.channel,
        forwarding: broker.forwarding({
          channel: subscription.channel,
          key: orderKey,
          publishTimeoutInMs: 500,
          retry: {
            minTimeout: 50,
            maxTimeout: 200,
            onRetry: (error) => failures.push(error),
          },
        }),
      });

      await broker.container.stop();
      await forwarding.append(orderKey);
      await until(() => failures.length >= 2);
      await broker.container.start();
      await forwarding.caughtUp();
      await forwarding.stop();

      const consumers = consumersOf(subscription);
      const received = collecting(consumers.consumer, subscription.queue);
      const { stop } = (await startAll([consumers]))[0]!;
      await consumers.consumer.whenCaughtUp({ timeout: 30_000 });
      await stop();
      expect(new Set(received)).toEqual(new Set([orderKey]));
    }, 120_000);

    it('theCommitOrAckComesOnlyAfterTheInboxWrite', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      await broker.send(subscription.channel, orderKey, 'o-1');
      const inbox = inboxWriterOf('inbox-test');
      const reactorOn = (consumer: BrokerQueueConsumer) =>
        consumer.reactor({
          processorId: subscription.queue,
          canHandle: ['test.external.SomethingHappened'],
          eachMessage: toWorkflowInbox<Something>(inbox),
        });

      const failing = consumersOf(
        subscription,
        failingInboxWriteEventStore(storeOfTest(), { remaining: 1 }),
      );
      reactorOn(failing.consumer);
      await failing.consumer.start().catch(() => undefined);
      await failing.consumer.close();
      await delay(500);
      const unsettledAfterFailure = await broker.unsettled(subscription);

      const store = storeOfTest();
      const retrying = consumersOf(subscription, store);
      reactorOn(retrying.consumer);
      const { stop } = await runningConsumer(retrying.consumer);
      await retrying.consumer.whenCaughtUp({ timeout: 30_000 });
      await until(async () => (await broker.unsettled(subscription)) === 0);
      await stop();

      expect(unsettledAfterFailure).toBe(1);
      expect(
        (await store.readStream(inboxStreamOf('inbox-test', 'o-1'))).events,
      ).toHaveLength(1);
    });

    it('aHandlerFailingOnceSucceedsOnRetry', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const attempts: number[] = [];
      const { consumer, deadLetters } = consumersOf(subscription);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromBrokerQueue(
          {
            deadLetters,
            retry: { retries: 2, minTimeout: 200, maxTimeout: 1000 },
          },
          () => {
            attempts.push(Date.now());
            if (attempts.length === 1) throw new Error('handler failed once');
          },
        ),
      });
      const { stop } = await runningConsumer(consumer);

      await broker.send(subscription.channel, orderKey);
      await consumer.whenCaughtUp({ timeout: 30_000 });
      await stop();

      expect(attempts).toHaveLength(2);
      expect(attempts[1]! - attempts[0]!).toBeGreaterThanOrEqual(190);
    });

    it('aHandlerFailingThreeTimesGoesToDeadLettersAndIsCounted', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      let attempts = 0;
      const { consumer, deadLetters } = consumersOf(subscription);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromBrokerQueue({ deadLetters, retry: fastRetry }, () => {
          attempts++;
          throw new Error('handler failed');
        }),
      });
      const { stop } = await runningConsumer(consumer);

      await broker.send(subscription.channel, orderKey);
      await consumer.whenCaughtUp({ timeout: 30_000 });
      await until(async () => (await broker.unsettled(subscription)) === 0);
      await stop();

      expect(attempts).toBe(3);
      expect(await broker.deadLetteredKeys(subscription.queue, 1)).toHaveLength(
        1,
      );
      expect(
        await counters.valueOf(deadLetteredCounter, {
          'message.type': 'test.external.SomethingHappened',
          'messaging.destination.name': subscription.queue,
        }),
      ).toBe(1);
    });

    it('aReadableMessageNoProcessorHandlesIsSkippedWithoutDeadLettersAndCatchUpDoesNotWaitForIt', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      let attempts = 0;
      const { consumer, deadLetters } = consumersOf(subscription);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromBrokerQueue({ deadLetters, retry: fastRetry }, () => {
          attempts++;
        }),
      });
      const { stop } = await runningConsumer(consumer);

      await broker.sendRaw(subscription.channel, {
        key: orderKey,
        headers: {
          [brokerHeaders.type]: 'test.Unknown',
          [brokerHeaders.messageId]: crypto.randomUUID(),
        },
        body: Buffer.from('{}'),
      });
      await consumer.whenCaughtUp({ timeout: 10_000 });
      await until(async () => (await broker.unsettled(subscription)) === 0);
      await stop();

      expect(attempts).toBe(0);
      expect(
        await counters.valueOf(deadLetteredCounter, {
          'message.type': 'test.Unknown',
          'messaging.destination.name': subscription.queue,
        }),
      ).toBe(0);
    });

    it('anUnreadableMessageGoesToDeadLettersWithoutRetries', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      let attempts = 0;
      const { consumer, deadLetters } = consumersOf(subscription);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromBrokerQueue({ deadLetters, retry: fastRetry }, () => {
          attempts++;
        }),
      });
      const { stop } = await runningConsumer(consumer);

      const headers = {
        [brokerHeaders.type]: 'test.external.SomethingHappened',
        [brokerHeaders.messageId]: crypto.randomUUID(),
      };
      const { [brokerHeaders.type]: _type, ...withoutType } = headers;
      await broker.sendRaw(subscription.channel, {
        key: orderKey,
        headers: withoutType,
        body: Buffer.from('{}'),
      });
      await broker.sendRaw(subscription.channel, {
        key: orderKey,
        headers,
        body: Buffer.from('{not json'),
      });
      await broker.sendRaw(subscription.channel, {
        key: orderKey,
        headers,
        body: Buffer.from('[1]'),
      });
      await until(async () => (await broker.unsettled(subscription)) === 0);
      await stop();

      expect(attempts).toBe(0);
      expect(await broker.deadLetteredKeys(subscription.queue, 3)).toHaveLength(
        3,
      );
    });

    it('afterABrokerRestartNewMessagesAreHandled', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const { consumer } = consumersOf(subscription);
      const received = collecting(consumer, subscription.queue);
      const { stop } = await runningConsumer(consumer);
      await broker.send(subscription.channel, orderKey);
      await until(() => received.length === 1);

      await broker.container.stop();
      await broker.container.start();
      await until(async () => {
        try {
          await broker.send(subscription.channel, cartKey);
          return true;
        } catch {
          return false;
        }
      }, 60_000);
      await until(() => received.includes(cartKey), 60_000);
      await stop();

      expect(received).toEqual([orderKey, cartKey]);
    }, 120_000);

    it('catchUpEndsWhenEveryMessageSentBeforeTheWaitIsHandled', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const handled: string[] = [];
      const { consumer } = consumersOf(subscription);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: async (message) => {
          await delay(200);
          handled.push(message.metadata.key ?? '');
        },
      });
      const { stop } = await runningConsumer(consumer);

      for (const key of [orderKey, cartKey, `${orderKey}.2`])
        await broker.send(subscription.channel, key);
      await consumer.whenCaughtUp({ timeout: 30_000 });
      await stop();

      expect(handled).toHaveLength(3);
    });

    it('aProcessorStartingAtTheEndDoesNotWaitForTheBrokerAndSkipsEarlierMessagesOfTheSameKey', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      await broker.send(subscription.channel, orderKey, 'first');
      await broker.send(subscription.channel, orderKey, 'second');
      const { consumer } = consumersOf(subscription);
      const received: string[] = [];
      consumer.reactor<Something>({
        processorId: subscription.queue,
        startFrom: 'END',
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: ({ data }) => {
          received.push(data.referenceId);
        },
      });
      const running = consumer.start();
      await consumer.whenStarted();

      await broker.send(subscription.channel, orderKey, 'third');
      await until(() => received.length === 1);
      await consumer.stop();
      await running.catch(() => undefined);
      await consumer.close();

      expect(received).toEqual(['third']);
    });

    it('aProcessorStartingAtTheEndDoesNotHoldBackTheCommitOfTheMessagesItSkips', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      await broker.send(subscription.channel, orderKey, 'first');
      await broker.send(subscription.channel, orderKey, 'second');
      const { consumer } = consumersOf(subscription);
      consumer.reactor<Something>({
        processorId: subscription.queue,
        startFrom: 'END',
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: () => undefined,
      });
      const { stop } = await runningConsumer(consumer);

      await until(async () => (await broker.unsettled(subscription)) === 0);
      await stop();
    });

    it('aCatchUpOnAConsumerThatIsNotRunningEndsWithinTheCallersTimeout', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      await broker.send(subscription.channel, orderKey);
      const { consumer } = consumersOf(subscription);
      collecting(consumer, subscription.queue);
      const startedAt = Date.now();

      await expect(consumer.whenCaughtUp({ timeout: 1000 })).rejects.toThrow();

      expect(Date.now() - startedAt).toBeLessThan(5000);
      await consumer.close();
    });

    it('aStoppedProcessorDoesNotHoldBackTheCommitsOfTheOthers', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const { consumer } = consumersOf(subscription);
      consumer.reactor({
        processorId: `${subscription.queue}-stopping`,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: () => MessageProcessor.result.stop({ reason: 'enough' }),
      });
      const received = collecting(consumer, subscription.queue);
      const { stop } = await runningConsumer(consumer);

      for (const key of [orderKey, cartKey, `${orderKey}.2`])
        await broker.send(subscription.channel, key);
      await until(() => received.length === 3);
      await until(async () => (await broker.unsettled(subscription)) === 0);
      await stop();

      expect([...received].sort()).toEqual(
        [orderKey, cartKey, `${orderKey}.2`].sort(),
      );
    });

    it('aProjectorOrAProcessorWithItsOwnCheckpointsIsRejectedClearly', () => {
      const { consumer } = consumersOf(queueOfTest());

      expect(() =>
        consumer.projector({
          processorId: 'projector',
          projection: {
            canHandle: ['test.external.SomethingHappened'],
            handle: () => Promise.resolve(),
          },
        }),
      ).toThrow('has no projectors');
      expect(() =>
        consumer.reactor({
          processorId: 'disabled',
          checkpoints: 'DISABLED',
          eachMessage: () => undefined,
        }),
      ).toThrow("can't set its checkpoints");
    });

    it('headersCarryTypeIdsAndTraceContext', async () => {
      const subscription = queueOfTest();
      await broker.declare(subscription);
      const received: {
        headers: Record<string, string>;
        traceId?: string;
        spanId?: string;
      }[] = [];
      const { consumer, deadLetters } = consumersOf(subscription);
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromBrokerQueue({ deadLetters }, ({ metadata }) => {
          received.push({
            headers: metadata.headers,
            traceId: metadata.traceId,
            spanId: metadata.spanId,
          });
        }),
      });
      const { stop } = await runningConsumer(consumer);
      const store = storeOfTest();
      const forward = broker.forwarding({
        channel: subscription.channel,
        key: orderKey,
        publishTimeoutInMs: 5000,
      });
      const sent = recordedSomething(
        something(orderKey, 'message-1', {
          correlationId: 'correlation-1',
          causationId: 'causation-1',
        }),
        {
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          spanId: '00f067aa0ba902b7',
        },
      );

      await invoke(forward, sent, store);
      await consumer.whenCaughtUp({ timeout: 30_000 });
      await stop();

      expect(received[0]?.headers).toMatchObject({
        [brokerHeaders.type]: 'test.external.SomethingHappened',
        [brokerHeaders.messageId]: 'message-1',
        [brokerHeaders.correlationId]: 'correlation-1',
        [brokerHeaders.causationId]: 'causation-1',
      });
      expect(received[0]).toMatchObject({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
      });
    });

    extras(() => broker, queueOfTest);
  });
