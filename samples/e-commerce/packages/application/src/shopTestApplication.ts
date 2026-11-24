import {
  ApiE2ESpecification,
  manualClock,
  removeSQLiteFolder,
  temporarySQLiteFolder,
} from '@e-commerce/core';
import { delay } from '@event-driven-io/emmett';
import { createApplication } from './application';
import {
  createModuleStores,
  storesOf,
  type EventStoreLocation,
} from './eventStore';
import { initialOrder, OrderId, type Order } from './orders/order';
import { orderWorkflowOptions } from './orders/orderWorkflow';
import { readSettings } from './settings';
import type { ShopLinks } from './shop/shopLayout';
import { changeablePrices } from './shoppingCarts/pricing/changeablePrices';

export type Environment = Record<string, string>;

export const sqliteWithoutABroker: Environment = {
  MESSAGING_BUS: 'none',
  EVENTSTORE_TYPE: 'sqlite',
};

export const inMemoryBusOnSQLite: Environment = {
  MESSAGING_BUS: 'in-memory',
  EVENTSTORE_TYPE: 'sqlite',
};

const startOfTests = new Date('2026-01-01T10:00:00.000Z');
const brokerSettlingInMs = 500;

export const eventually = async (
  assertion: () => void | Promise<void>,
  timeoutInMs = 30_000,
) => {
  const deadline = Date.now() + timeoutInMs;

  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;

      await delay(100);
    }
  }
};

export const shopTestApplication = ({
  environment = sqliteWithoutABroker,
  links,
  signal,
  gateways,
}: {
  gateways?: Pick<Parameters<typeof createApplication>[0], 'paymentGateway' | 'warehouse'>;
  environment?: Environment;
  links?: ShopLinks;
  signal?: AbortSignal;
} = {}) => {
  const settings = readSettings({
    ...environment,
    WORKERS_SCHEDULED: 'false',
    MESSAGING_RETRY_INITIAL_INTERVAL: '20ms',
  });
  const clock = manualClock(startOfTests);
  const prices = changeablePrices();
  const folder =
    settings.eventStoreType === 'sqlite' ? temporarySQLiteFolder() : undefined;
  const location: EventStoreLocation = folder
    ? { type: 'sqlite', folder }
    : { type: 'postgresql', connectionString: settings.postgreSQLUrl };
  const stores = createModuleStores(location, settings.messagingBus, {
    pullingFrequencyInMs: 20,
    batchSize: 1,
  });
  const application = createApplication({
    stores,
    internalDelivery: settings.messagingInternalDelivery,
    connections: {
      kafka: {
        connection: { bootstrapBrokers: settings.kafkaBootstrapServers },
        publishTimeoutInMs: settings.kafkaPublishTimeoutInMs,
      },
      rabbitMQ: {
        connection: { url: settings.rabbitMQUrl },
        publishTimeoutInMs: settings.rabbitMQPublishTimeoutInMs,
      },
    },
    messagingRetry: { minTimeout: 20, maxTimeout: 100 },
    prices,
    now: clock.now,
    ...gateways,
    ...(links ? { links } : {}),
  });
  const sources = storesOf(stores).map((database) => database.messageSource());
  const isBroker = settings.messagingBus !== 'none';

  const storesEnd = async () =>
    (
      await Promise.all(
        sources.map((source) => source.readLastMessageCheckpoint()),
      )
    ).join();

  const caughtUp = () =>
    Promise.all(
      application.consumers.map((consumer) =>
        consumer.whenCaughtUp({ timeout: 30_000 }),
      ),
    );

  let stopping: Promise<void> | undefined;
  const stop = () => {
    stopping ??= application
      .stop()
      .then(() => (folder ? removeSQLiteFolder(folder) : undefined));

    return stopping;
  };

  signal?.addEventListener('abort', () => void stop());

  const given = ApiE2ESpecification.for({
    fetch: application.fetch,
    start: application.start,
    stop,
    clock,
    workers: application.workers,
    catchUp: async () => {
      if (signal?.aborted) return false;

      const endBefore = await storesEnd();

      await caughtUp();
      if (isBroker) {
        await delay(brokerSettlingInMs);
        await caughtUp();
      }

      return (await storesEnd()) !== endBefore && !signal?.aborted;
    },
  });

  const orderOf = async (orderId: string): Promise<Order> => {
    const { workflow } = orderWorkflowOptions(clock.now);

    return (
      await stores.orders.store.aggregateStream(
        OrderId.workflowStreamNameOf(orderId),
        { evolve: workflow.evolve, initialState: initialOrder },
      )
    ).state;
  };

  return {
    given,
    fetch: application.fetch,
    start: application.start,
    stop,
    clock,
    prices,
    sandboxes: application.sandboxes,
    orderOf,
  };
};

export type ShopTestApplication = ReturnType<typeof shopTestApplication>;
