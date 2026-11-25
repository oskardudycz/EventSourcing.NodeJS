import {
  type DefaultRecord,
  type Event,
  type RecordedMessage,
  WorkflowHandler,
  type Workflow,
} from '@event-driven-io/emmett';
import {
  getSQLiteEventStore,
  type SQLiteEventStore,
} from '@event-driven-io/emmett-sqlite';
import { sqlite3EventStoreDriver } from '@event-driven-io/emmett-sqlite/sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Urns } from '../identifiers';
import {
  removeSQLiteFiles,
  temporarySQLiteFilePath,
} from '../testing/temporarySQLiteFile';
import {
  channelStreamName,
  type ChannelMessageMetadata,
  type ForwardedMessageMetadata,
  deadLetterStreamName,
  type ForwardedMessage,
  fromChannel,
  toWorkflowInbox,
} from './channels';
import { forwardToChannels, getForwarderId } from './eventStoreForwarder';
import { externalMessageId } from './messageIds';
import { describeForwarding } from './forwardingSuite';
import { messageRoutes, routeChannel, routeKey } from './messageRoutes';

type Something = Event<
  'test.SomethingHappened',
  { referenceId: string; amount: number }
>;
type ExternalSomething = Event<
  'test.external.SomethingHappened',
  { referenceId: string; amount: number }
>;
type DoSomething = Event<'test.DoSomething', { entityId: string }>;

const channel = 'test-external';

const something = (referenceId: string, amount = 1): Something => ({
  type: 'test.SomethingHappened',
  data: { referenceId, amount },
});

const routesToChannel = messageRoutes<ForwardedMessage<Something>>(
  routeChannel('test.SomethingHappened', channel),
  routeKey('test.SomethingHappened', (message) =>
    Urns.routingKeyOf(message.data.referenceId),
  ),
);

const routesExternalToChannel = messageRoutes<
  ForwardedMessage<ExternalSomething>
>(
  routeChannel('test.external.SomethingHappened', channel),
  routeKey('test.external.SomethingHappened', (message) =>
    Urns.routingKeyOf(message.data.referenceId),
  ),
);

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

describe('event store forwarder', () => {
  let fileName: string;
  let store: SQLiteEventStore;
  let abort: AbortController;
  const reference = Urns.of('ecommerce', 'order', 'o-1');

  beforeEach(() => {
    abort = new AbortController();
    fileName = temporarySQLiteFilePath();
    store = getSQLiteEventStore({ driver: sqlite3EventStoreDriver, fileName });
  });

  afterEach(async () => {
    await store.close();
    await removeSQLiteFiles(fileName);
  });

  const channelMessages = async () =>
    (await store.readStream(channelStreamName(channel))).events;

  const withConsumer = async (
    register: (consumer: ReturnType<SQLiteEventStore['consumer']>) => void,
    act: (consumer: ReturnType<SQLiteEventStore['consumer']>) => Promise<void>,
  ) => {
    const consumer = store.consumer({ pulling: { pullingFrequencyInMs: 10 } });
    register(consumer);
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

  it('aForwarderAppendsToTheStoreChosenForTheChannel', async () => {
    const otherFileName = temporarySQLiteFilePath();
    const otherStore = getSQLiteEventStore({
      driver: sqlite3EventStoreDriver,
      fileName: otherFileName,
    });

    try {
      await withConsumer(
        (consumer) =>
          consumer.reactor({
            processorId: getForwarderId({ name: 'to-other-store' }),
            canHandle: ['test.SomethingHappened'],
            eachBatch: forwardToChannels<Something>({
              channels: [channel],
              routes: [routesToChannel],
              storeOf: () => otherStore,
            }),
          }),
        async (consumer) => {
          await store.appendToStream('source-1', [something(reference)]);
          await consumer.whenCaughtUp({ timeout: 5000 });
        },
      );

      expect(await channelMessages()).toHaveLength(0);
      expect(
        (await otherStore.readStream(channelStreamName(channel))).events,
      ).toHaveLength(1);
    } finally {
      await otherStore.close();
      await removeSQLiteFiles(otherFileName);
    }
  });

  it('routingKeysComeFromURNs', async () => {
    const commandRoutes = messageRoutes<ForwardedMessage<DoSomething>>(
      routeChannel('test.DoSomething', channel),
      routeKey('test.DoSomething', (message) =>
        Urns.routingKeyOf(message.data.entityId),
      ),
    );

    await withConsumer(
      (consumer) =>
        consumer.reactor({
          processorId: getForwarderId({ name: 'keys' }),
          canHandle: ['test.DoSomething', 'test.SomethingHappened'],
          eachBatch: forwardToChannels<DoSomething | Something>({
            channels: [channel],
            routes: [commandRoutes, routesToChannel],
          }),
        }),
      async (consumer) => {
        await store.appendToStream('source-1', [
          {
            type: 'test.DoSomething',
            data: { entityId: 'urn:ecommerce:cart:c-1' },
          },
          something(reference),
        ]);
        await consumer.whenCaughtUp({ timeout: 5000 });
      },
    );

    expect(await channelMessages()).toMatchObject([
      { metadata: { key: 'ecommerce.cart.c-1' } },
      { metadata: { key: 'ecommerce.order.o-1' } },
    ]);
  });

  it('anExternalEventIdIsDerivedFromTheInternalIdAndType', () => {
    expect(externalMessageId('abc', 'x.external.Y')).toBe(
      externalMessageId('abc', 'x.external.Y'),
    );
    expect(externalMessageId('abc', 'x.external.Y')).not.toBe(
      externalMessageId('abd', 'x.external.Y'),
    );
    expect(externalMessageId('abc', 'x.external.Y')).not.toBe(
      externalMessageId('abc', 'x.external.Z'),
    );
  });
});

describe('channel reactor', () => {
  let fileName: string;
  let store: SQLiteEventStore;
  const reference = Urns.of('ecommerce', 'order', 'o-1');

  beforeEach(() => {
    fileName = temporarySQLiteFilePath();
    store = getSQLiteEventStore({ driver: sqlite3EventStoreDriver, fileName });
  });

  afterEach(async () => {
    await store.close();
    await removeSQLiteFiles(fileName);
  });

  const forwardToChannel = (
    consumer: ReturnType<SQLiteEventStore['consumer']>,
  ) =>
    consumer.reactor({
      processorId: getForwarderId({ name: 'to-channel' }),
      canHandle: ['test.SomethingHappened'],
      eachBatch: forwardToChannels<Something, ExternalSomething>({
        channels: [channel],
        routes: [routesExternalToChannel],
        map: toExternal,
      }),
    });

  const runUntilCaughtUp = async (
    register: (consumer: ReturnType<SQLiteEventStore['consumer']>) => void,
    ...messages: Something[]
  ) => {
    const consumer = store.consumer({ pulling: { pullingFrequencyInMs: 10 } });
    register(consumer);
    const running = consumer.start();
    try {
      await store.appendToStream('source-1', messages);
      for (let round = 0; round < 3; round++)
        await consumer.whenCaughtUp({ timeout: 5000 });
    } finally {
      await consumer.stop();
      await running.catch(() => undefined);
      await consumer.close();
    }
  };

  it('aChannelReactorGetsOnlyTheMessagesItsBindingKeyMatches', async () => {
    const received: (string | undefined)[] = [];

    await runUntilCaughtUp(
      (consumer) => {
        forwardToChannel(consumer);
        consumer.reactor({
          processorId: 'orders-only',
          canHandle: ['test.external.SomethingHappened'],
          eachMessage: fromChannel<ExternalSomething>(
            { channel, queue: 'orders-only', bindingKey: 'ecommerce.order.*' },
            (message) => {
              received.push(message.metadata.key);
            },
          ),
        });
      },
      something(reference),
      something(Urns.of('ecommerce', 'cart', 'c-1')),
    );

    expect(received).toEqual(['ecommerce.order.o-1']);
  });

  it('aChannelReactorDeadLettersAMessageWhenItsRetriesRunOut', async () => {
    let attempts = 0;

    await runUntilCaughtUp((consumer) => {
      forwardToChannel(consumer);
      consumer.reactor({
        processorId: 'always-failing',
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromChannel(
          {
            channel,
            queue: 'always-failing',
            retry: { retries: 2, minTimeout: 1, maxTimeout: 5 },
          },
          () => {
            attempts++;
            throw new Error('handler failed');
          },
        ),
      });
    }, something(reference));

    expect(attempts).toBe(3);
    expect(
      (await store.readStream(deadLetterStreamName('always-failing'))).events,
    ).toMatchObject([
      {
        type: 'test.external.SomethingHappened',
        metadata: { key: 'ecommerce.order.o-1' },
      },
    ]);
  });

  it('aChannelReactorRetriesAFailedHandlerAndDeadLettersNothingWhenItSucceeds', async () => {
    let attempts = 0;

    await runUntilCaughtUp((consumer) => {
      forwardToChannel(consumer);
      consumer.reactor({
        processorId: 'failing-once',
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromChannel(
          {
            channel,
            queue: 'failing-once',
            retry: { retries: 2, minTimeout: 1, maxTimeout: 5 },
          },
          () => {
            attempts++;
            if (attempts === 1) throw new Error('handler failed once');
          },
        ),
      });
    }, something(reference));

    expect(attempts).toBe(2);
    expect(
      (await store.readStream(deadLetterStreamName('failing-once'))).events,
    ).toEqual([]);
  });

  it('aChannelReactorSkipsTheSameTypeOutsideTheChannel', async () => {
    const received: string[] = [];

    await runUntilCaughtUp(
      (consumer) =>
        consumer.reactor({
          processorId: 'channel-only',
          canHandle: ['test.SomethingHappened'],
          eachMessage: fromChannel<Something>(
            { channel, queue: 'channel-only' },
            (message) => {
              received.push(message.metadata.streamName);
            },
          ),
        }),
      something(reference),
    );

    expect(received).toEqual([]);
  });

  it('aChannelReactorStoresTheMessageInTheWorkflowInbox', async () => {
    const decided: string[] = [];
    const workflow: Workflow<
      ExternalSomething,
      Record<string, never>,
      Event
    > = {
      name: 'testWorkflow',
      decide: (input) => {
        decided.push(input.type);
        return [];
      },
      evolve: (state) => state,
      initialState: () => ({}),
    };
    const storeInInbox = WorkflowHandler<
      ExternalSomething,
      Record<string, never>,
      Event
    >({
      workflow,
      getWorkflowId: (message) => message.data.referenceId,
      separateInputInboxFromProcessing: true,
      inputs: { commands: [], events: ['test.external.SomethingHappened'] },
      outputs: { commands: [], events: [] },
    });

    await runUntilCaughtUp((consumer) => {
      forwardToChannel(consumer);
      consumer.reactor({
        processorId: 'test-workflow-inbox',
        canHandle: ['test.external.SomethingHappened'],
        eachMessage: fromChannel(
          { channel, queue: 'test-workflow-inbox' },
          toWorkflowInbox<ExternalSomething>(storeInInbox),
        ),
      });
    }, something(reference));

    const inbox = await store.readStream(
      `emt:workflow:testWorkflow:${reference}`,
    );
    expect(inbox.events.map((event) => event.type)).toEqual([
      'testWorkflow:test.external.SomethingHappened',
    ]);
    expect(decided).toEqual([]);
  });
});

type ChannelEvent = Event<
  string,
  DefaultRecord,
  ChannelMessageMetadata & ForwardedMessageMetadata
>;

describeForwarding(
  'channel streams',
  () =>
    Promise.resolve({
      forwarder: (options) => forwardToChannels(options),
      declare: () => Promise.resolve(),
      observe: (subscription, store) =>
        Promise.resolve({
          received: async () =>
            (
              await store.readStream<ChannelEvent>(
                channelStreamName(subscription.channel),
              )
            ).events.map(({ type, metadata }) => ({
              type,
              key: metadata.key,
              messageId: metadata.messageId,
              causationId: metadata.causationId,
            })),
          caughtUp: () => Promise.resolve(),
          close: () => Promise.resolve(),
        }),
      stop: () => Promise.resolve(),
    }),
  { appendRollsBackWithTheCheckpoint: true },
);
