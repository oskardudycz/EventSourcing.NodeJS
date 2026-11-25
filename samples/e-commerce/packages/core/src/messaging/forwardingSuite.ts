import type {
  Event,
  Message,
  RecordedMessage,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import { delay } from '@event-driven-io/emmett';
import {
  getSQLiteEventStore,
  type SQLiteEventStore,
} from '@event-driven-io/emmett-sqlite';
import { sqlite3EventStoreDriver } from '@event-driven-io/emmett-sqlite/sqlite3';
import { dumbo } from '@event-driven-io/dumbo';
import { sqlite3DumboDriver } from '@event-driven-io/dumbo/sqlite3';
import { readProcessorCheckpoint } from '@event-driven-io/emmett-sqlite';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { Urns } from '../identifiers';
import {
  removeSQLiteFiles,
  temporarySQLiteFilePath,
} from '../testing/temporarySQLiteFile';
import { until } from '../testing/brokerTesting';
import {
  channelStreamName,
  type ChannelSubscription,
  type ForwardedMessage,
} from './channels';
import {
  getForwarderId,
  type ForwardingHandler,
  type ForwardingOptions,
} from './eventStoreForwarder';
import { externalMessageId } from './messageIds';
import { messageRoutes, routeChannel, routeKey } from './messageRoutes';

export type ObservedMessage = {
  type: string;
  key: string | undefined;
  messageId: string;
  causationId: string | undefined;
};

export type Observed = {
  received(): Promise<ObservedMessage[]>;
  caughtUp(): Promise<void>;
  close(): Promise<void>;
};

export type ForwardingTarget = {
  forwarder: <Input extends Message, Outgoing extends Message>(
    options: ForwardingOptions<Input, Outgoing>,
  ) => ForwardingHandler<Input>;
  declare(
    channel: string,
    queues: readonly ChannelSubscription[],
  ): Promise<void>;
  observe(
    subscription: ChannelSubscription,
    store: SQLiteEventStore,
  ): Promise<Observed>;
  outage?: { stop(): Promise<unknown>; start(): Promise<unknown> };
  stop(): Promise<void>;
};

type Something = Event<
  'test.SomethingHappened',
  { referenceId: string; amount: number }
>;
type ExternalSomething = Event<
  'test.external.SomethingHappened',
  { referenceId: string; amount: number }
>;
type Unrouted = Event<'test.Unrouted', Record<string, never>>;

const toExternal = (
  message: RecordedMessage<Something>,
): ForwardedMessage<ExternalSomething>[] => [
  {
    type: 'test.external.SomethingHappened',
    data: message.data,
    metadata: {
      messageId: externalMessageId(
        message.metadata.messageId,
        'test.external.SomethingHappened',
      ),
      correlationId: message.metadata.correlationId,
      causationId: message.metadata.messageId,
    },
  },
];

const toUnrouted = (
  message: RecordedMessage<Unrouted>,
): ForwardedMessage<Unrouted>[] => [
  {
    type: message.type,
    data: message.data,
    metadata: { messageId: message.metadata.messageId },
  },
];

const failureMessageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const describeForwarding = (
  name: string,
  startTarget: () => Promise<ForwardingTarget>,
  { appendRollsBackWithTheCheckpoint = false } = {},
) =>
  describe(`forwarding to ${name}`, () => {
    let target: ForwardingTarget;
    let fileName: string;
    let store: SQLiteEventStore;
    let abort: AbortController;
    const reference = Urns.of('ecommerce', 'order', 'o-1');
    const forwarderId = getForwarderId({ name: 'forwarding-suite' });

    beforeAll(async () => {
      target = await startTarget();
    }, 180_000);

    afterAll(async () => {
      await target.stop();
    }, 60_000);

    beforeEach(() => {
      abort = new AbortController();
      fileName = temporarySQLiteFilePath();
      store = getSQLiteEventStore({
        driver: sqlite3EventStoreDriver,
        fileName,
      });
    });

    afterEach(async () => {
      abort.abort();
      await store.close();
      await removeSQLiteFiles(fileName);
    });

    const checkpointOfForwarder = async () => {
      const pool = dumbo({ driver: sqlite3DumboDriver, fileName });
      try {
        return (
          await readProcessorCheckpoint(pool.execute, {
            processorId: forwarderId,
          })
        ).lastProcessedCheckpoint;
      } finally {
        await pool.close();
      }
    };

    const observing = async (
      use: (channel: string, observed: Observed) => Promise<void>,
    ) => {
      const channel = `test-${crypto.randomUUID()}`;
      const subscription = { channel, queue: `queue-${crypto.randomUUID()}` };
      await target.declare(channel, [subscription]);
      const observed = await target.observe(subscription, store);

      try {
        await use(channel, observed);
      } finally {
        await observed.close();
      }
    };

    const forwarding = async <Input extends Message>(
      handler: ForwardingHandler<Input>,
      act: (
        consumer: ReturnType<SQLiteEventStore['consumer']>,
      ) => Promise<void>,
    ) => {
      const consumer = store.consumer({
        pulling: { pullingFrequencyInMs: 10 },
      });
      consumer.reactor({
        processorId: forwarderId,
        canHandle: ['test.SomethingHappened', 'test.Unrouted'],
        eachBatch: handler,
      });
      const running = consumer.start();

      try {
        await act(consumer);
      } finally {
        abort.abort();
        await consumer.stop();
        await running.catch(() => undefined);
        await consumer.close();
      }
    };

    const routesFor = (channel: string) => [
      messageRoutes<ForwardedMessage<ExternalSomething>>(
        routeChannel('test.external.SomethingHappened', channel),
        routeKey('test.external.SomethingHappened', (message) =>
          Urns.routingKeyOf(message.data.referenceId),
        ),
      ),
    ];

    const forwardSomething = (
      channel: string,
      options: {
        retry?: ForwardingOptions<Something, ExternalSomething>['retry'];
        signal?: AbortSignal;
      } = {},
    ) =>
      target.forwarder<Something, ExternalSomething>({
        channels: [channel],
        routes: routesFor(channel),
        map: toExternal,
        ...options,
      });

    const something = (referenceId: string): Something => ({
      type: 'test.SomethingHappened',
      data: { referenceId, amount: 1 },
    });

    it('aRoutedMessageArrivesWithItsKeyAndTheForwarderSavesItsCheckpoint', async () => {
      let received: ObservedMessage[] = [];

      await observing(async (channel, observed) => {
        await forwarding(forwardSomething(channel), async (consumer) => {
          await store.appendToStream('source-1', [something(reference)]);
          await consumer.whenCaughtUp({ timeout: 30_000 });
          await observed.caughtUp();
        });
        received = await observed.received();
      });

      expect(received).toMatchObject([
        {
          type: 'test.external.SomethingHappened',
          key: 'ecommerce.order.o-1',
        },
      ]);
      expect(await checkpointOfForwarder()).not.toBeNull();
    });

    it('aForwardedMessageKeepsItsIdAndCausationDerivedFromTheInternalOne', async () => {
      let received: ObservedMessage[] = [];

      await observing(async (channel, observed) => {
        await forwarding(forwardSomething(channel), async (consumer) => {
          await store.appendToStream('source-1', [something(reference)]);
          await consumer.whenCaughtUp({ timeout: 30_000 });
          await observed.caughtUp();
        });
        received = await observed.received();
      });

      const [source] = (await store.readStream('source-1')).events;
      expect(received).toMatchObject([
        {
          messageId: externalMessageId(
            source?.metadata.messageId ?? '',
            'test.external.SomethingHappened',
          ),
          causationId: source?.metadata.messageId,
        },
      ]);
    });

    it('anUnroutedTypeFailsNamingTheTypeAndNothingIsSent', async () => {
      const failures: string[] = [];
      let received: ObservedMessage[] = [];

      await observing(async (channel, observed) => {
        await forwarding(
          target.forwarder<Unrouted, Unrouted>({
            channels: [channel],
            routes: [
              messageRoutes<ForwardedMessage<Unrouted>>(
                routeChannel('test.SomethingHappened', channel),
              ),
            ],
            map: toUnrouted,
            signal: abort.signal,
            retry: {
              minTimeout: 1,
              maxTimeout: 5,
              onRetry: (error) => failures.push(failureMessageOf(error)),
            },
          }),
          async () => {
            await store.appendToStream('source-1', [
              { type: 'test.Unrouted', data: {} },
            ]);
            await until(() => failures.length >= 3);
          },
        );
        received = await observed.received();
      });

      expect(failures.slice(0, 3)).toEqual(
        Array(3).fill("No route for message type 'test.Unrouted'"),
      );
      expect(received).toEqual([]);
    });

    it('anUndeclaredChannelFailsNamingTheChannelAndNothingIsSent', async () => {
      const failures: string[] = [];
      let received: ObservedMessage[] = [];

      await observing(async (channel, observed) => {
        await forwarding(
          target.forwarder<Something, ExternalSomething>({
            channels: [channel],
            routes: [
              messageRoutes<ForwardedMessage<ExternalSomething>>(
                routeChannel('test.external.SomethingHappened', 'nowhere'),
              ),
            ],
            map: toExternal,
            signal: abort.signal,
            retry: {
              minTimeout: 1,
              maxTimeout: 5,
              onRetry: (error) => failures.push(failureMessageOf(error)),
            },
          }),
          async () => {
            await store.appendToStream('source-1', [something(reference)]);
            await until(() => failures.length >= 1);
          },
        );
        received = await observed.received();
      });

      expect(failures[0]).toBe(
        "Channel 'nowhere' of message type 'test.external.SomethingHappened' is not declared",
      );
      expect(received).toEqual([]);
    });

    it('aSendIsPreparedForAllMessagesBeforeAnyIsSent', async () => {
      const failures: string[] = [];
      let received: ObservedMessage[] = [];
      const unroutable: ForwardedMessage<Unrouted> = {
        type: 'test.Unrouted',
        data: {},
        metadata: { messageId: 'unroutable-1' },
      };

      await observing(async (channel, observed) => {
        await forwarding(
          target.forwarder<Something, ExternalSomething | Unrouted>({
            channels: [channel],
            routes: routesFor(channel),
            map: (message) => [...toExternal(message), unroutable],
            signal: abort.signal,
            retry: {
              minTimeout: 1,
              maxTimeout: 5,
              onRetry: (error) => failures.push(failureMessageOf(error)),
            },
          }),
          async () => {
            await store.appendToStream('source-1', [something(reference)]);
            await until(() => failures.length >= 3);
          },
        );
        received = await observed.received();
      });

      expect(failures.slice(0, 3)).toEqual(
        Array(3).fill("No route for message type 'test.Unrouted'"),
      );
      expect(received).toEqual([]);
    });

    it('aForwarderIgnoresMessagesThatAreAlreadyInAChannelStream', async () => {
      let received: ObservedMessage[] = [];

      await observing(async (channel, observed) => {
        await forwarding(forwardSomething(channel), async (consumer) => {
          await store.appendToStream(channelStreamName('another-channel'), [
            something(reference),
          ]);
          await consumer.whenCaughtUp({ timeout: 30_000 });
          await observed.caughtUp();
        });
        received = await observed.received();
      });

      expect(received).toEqual([]);
    });

    it('aForwarderThatFailsAfterSendingAndBeforeItsCheckpointSendsTheSameIdsAgain', async () => {
      let received: ObservedMessage[] = [];

      await observing(async (channel, observed) => {
        const forward = forwardSomething(channel);
        let crashed = false;

        await forwarding(
          async (
            messages: RecordedMessage<Something>[],
            context: WorkflowProcessorContext,
          ) => {
            await forward(messages, context);
            if (!crashed) {
              crashed = true;
              throw new Error('The forwarder crashed after sending');
            }
          },
          async () => {
            await store.appendToStream('source-1', [something(reference)]);
            await until(() => crashed);
          },
        );
        await forwarding(forward, async (consumer) => {
          await consumer.whenCaughtUp({ timeout: 30_000 });
          await observed.caughtUp();
        });
        received = await observed.received();
      });

      const [source] = (await store.readStream('source-1')).events;
      const sentId = externalMessageId(
        source?.metadata.messageId ?? '',
        'test.external.SomethingHappened',
      );
      expect(new Set(received.map(({ messageId }) => messageId))).toEqual(
        new Set([sentId]),
      );
      expect(received).toHaveLength(appendRollsBackWithTheCheckpoint ? 1 : 2);
    });

    it.fails(
      'aModuleCanStillAppendWhileAForwarderRetriesADownBroker',
      async (context) => {
        const { outage } = target;
        if (outage === undefined) return context.skip();
        const failures: unknown[] = [];
        const module = getSQLiteEventStore({
          driver: sqlite3EventStoreDriver,
          fileName,
        });
        let outcome = 'not tried';

        try {
          await observing(async (channel, observed) => {
            await forwarding(
              forwardSomething(channel, {
                retry: {
                  minTimeout: 50,
                  maxTimeout: 200,
                  onRetry: (error) => failures.push(error),
                },
              }),
              async (consumer) => {
                await outage.stop();
                try {
                  await store.appendToStream('source-1', [
                    something(reference),
                  ]);
                  await until(() => failures.length >= 2);

                  outcome = await Promise.race([
                    module.appendToStream('module-1', [something('o-2')]).then(
                      () => 'appended',
                      (error: unknown) => failureMessageOf(error),
                    ),
                    delay(3000).then(() => 'blocked'),
                  ]);
                } finally {
                  await outage.start();
                }

                await consumer.whenCaughtUp({ timeout: 60_000 });
                await observed.caughtUp();
              },
            );
          });
        } finally {
          await module.close();
        }

        expect(outcome).toBe('appended');
      },
      180_000,
    );
  });
