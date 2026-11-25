import {
  noopScope,
  WorkflowHandler,
  workflowStreamName,
  type Event,
  type RecordedMessage,
  type Workflow,
} from '@event-driven-io/emmett';
import {
  getSQLiteEventStore,
  type SQLiteEventStore,
} from '@event-driven-io/emmett-sqlite';
import { sqlite3EventStoreDriver } from '@event-driven-io/emmett-sqlite/sqlite3';
import {
  removeSQLiteFiles,
  temporarySQLiteFilePath,
} from '../../testing/temporarySQLiteFile';
import type { ForwardedMessage } from '../channels';
import { getForwarderId, type ForwardingHandler } from '../eventStoreForwarder';
import { messageRoutes, routeChannel, routeKey } from '../messageRoutes';
import type { Observed, ObservedMessage } from '../forwardingSuite';
import type { BrokerQueueConsumer } from './brokerQueueConsumer';

export type Something = Event<
  'test.external.SomethingHappened',
  { referenceId: string; amount: number }
>;

export const something = (
  referenceId: string,
  messageId: string = crypto.randomUUID(),
  metadata: { correlationId?: string; causationId?: string } = {},
): ForwardedMessage<Something> => ({
  type: 'test.external.SomethingHappened',
  data: { referenceId, amount: 1 },
  metadata: { messageId, ...metadata },
});

export const routesTo = (channel: string, key: string) =>
  messageRoutes<ForwardedMessage<Something>>(
    routeChannel('test.external.SomethingHappened', channel),
    routeKey('test.external.SomethingHappened', () => key),
  );

export const temporaryStore = () => {
  const fileName = temporarySQLiteFilePath();
  const store = getSQLiteEventStore({
    driver: sqlite3EventStoreDriver,
    fileName,
  });

  return {
    store,
    fileName,
    dispose: async () => {
      await store.close();
      await removeSQLiteFiles(fileName);
    },
  };
};

export const failingInboxWriteEventStore = (
  store: SQLiteEventStore,
  failures: { remaining: number },
): SQLiteEventStore => ({
  ...store,
  appendToStream: (streamName, events, options) => {
    if (failures.remaining > 0) {
      failures.remaining--;
      return Promise.reject(new Error('The inbox write failed'));
    }
    return store.appendToStream(streamName, events, options);
  },
  withSession: (callback) =>
    store.withSession((session) =>
      callback({
        ...session,
        eventStore: failingInboxWriteEventStore(session.eventStore, failures),
      }),
    ),
});

export const inboxWriterOf = (workflowName: string) => {
  const workflow: Workflow<Something, Record<string, never>, Event> = {
    name: workflowName,
    decide: () => [],
    evolve: (state) => state,
    initialState: () => ({}),
  };

  return WorkflowHandler<Something, Record<string, never>, Event>({
    workflow,
    getWorkflowId: (message) => message.data.referenceId,
    separateInputInboxFromProcessing: true,
    inputs: { commands: [], events: ['test.external.SomethingHappened'] },
    outputs: { commands: [], events: [] },
  });
};

export const inboxStreamOf = (workflowName: string, workflowId: string) =>
  workflowStreamName({ workflowName, workflowId });

export const runningConsumer = async (consumer: BrokerQueueConsumer) => {
  const running = consumer.start();
  await consumer.whenStarted();

  return {
    running,
    stop: async () => {
      await consumer.stop();
      await running.catch(() => undefined);
      await consumer.close();
    },
  };
};

export const forwardingFromStore = ({
  store,
  forwarding,
  channel,
}: {
  store: SQLiteEventStore;
  forwarding: ForwardingHandler<Something>;
  channel: string;
}) => {
  const consumer = store.consumer({ pulling: { pullingFrequencyInMs: 10 } });
  consumer.reactor({
    processorId: getForwarderId({ name: `to-${channel}` }),
    canHandle: ['test.external.SomethingHappened'],
    eachBatch: forwarding,
  });
  const running = consumer.start();

  return {
    append: (
      referenceId: string,
      streamName = `source-${crypto.randomUUID()}`,
    ) =>
      store.appendToStream(streamName, [
        {
          type: 'test.external.SomethingHappened',
          data: { referenceId, amount: 1 },
        },
      ]),
    caughtUp: () => consumer.whenCaughtUp({ timeout: 30_000 }),
    stop: async () => {
      await consumer.stop();
      await running.catch(() => undefined);
      await consumer.close();
    },
  };
};

export const observingQueue = async (
  consumer: BrokerQueueConsumer,
  processorId: string,
): Promise<Observed> => {
  const received: ObservedMessage[] = [];
  consumer.reactor({
    processorId,
    canHandle: ['test.external.SomethingHappened'],
    eachMessage: ({ type, metadata }) => {
      received.push({
        type,
        key: metadata.key,
        messageId: metadata.messageId,
        causationId: metadata.causationId,
      });
    },
  });
  const { stop } = await runningConsumer(consumer);

  return {
    received: () => Promise.resolve([...received]),
    caughtUp: () => consumer.whenCaughtUp({ timeout: 30_000 }),
    close: stop,
  };
};

export const recordedSomething = (
  { type, data, metadata }: ForwardedMessage<Something>,
  trace: { traceId?: string; spanId?: string } = {},
): RecordedMessage<Something> => ({
  type,
  data,
  kind: 'Event',
  schemaVersion: 1,
  metadata: {
    ...metadata,
    ...trace,
    streamName: 'source-1',
    streamPosition: 0n,
    globalPosition: '1',
  },
});

export const invoke = (
  handler: ForwardingHandler<Something>,
  message: RecordedMessage<Something>,
  messageStore: SQLiteEventStore,
) =>
  handler([message], {
    session: { messageStore },
    observabilityScope: noopScope,
  });
