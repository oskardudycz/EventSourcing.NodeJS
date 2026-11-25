import {
  ApiE2ESpecification,
  manualClock,
  removeSQLiteFolder,
  temporarySQLiteFolder,
} from '@e-commerce/core';
import { afterAll } from 'vitest';
import { delay, type Message } from '@event-driven-io/emmett';
import { createApplication, type ModuleName } from './application';
import { buildApplication } from './buildApplication';
import {
  createModuleStores,
  storesOf,
  type ModuleStores,
  type Pulling,
} from './eventStore';
import { readSettings, type Settings } from './settings';
import { deliverFromOutsideWorld } from './testApplication';
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

const brokerSettlingInMs = 500;
const caughtUpWithinMs = 10_000;
const pulling: Pulling = { pullingFrequencyInMs: 20, batchSize: 1 };

type Dependencies = {
  prices: ReturnType<typeof changeablePrices>;
  now: () => Date;
};

const applicationOf = (
  settings: Settings,
  { prices, now }: Dependencies,
  modules: readonly ModuleName[] | undefined,
) => {
  if (!modules) {
    const built = buildApplication(settings, { prices, now, pulling });

    return {
      application: built.application,
      stores: built.stores,
      stop: built.stop,
    };
  }

  const folder = temporarySQLiteFolder();
  const stores = createModuleStores(
    { type: 'sqlite', folder },
    settings.messagingBus,
    pulling,
  );
  const application = createApplication(
    {
      stores,
      internalDelivery: settings.messagingInternalDelivery,
      prices,
      now,
      messagingRetry: { minTimeout: 20, maxTimeout: 100 },
    },
    { modules },
  );

  return {
    application,
    stores,
    stop: async () => {
      await application.stop();
      await removeSQLiteFolder(folder);
    },
  };
};

const storesEndOf = async (stores: ModuleStores) =>
  (
    await Promise.all(
      storesOf(stores).map(async (database) =>
        database.messageSource().readLastMessageCheckpoint(),
      ),
    )
  ).join();

export const shopTestApplication = ({
  environment = sqliteWithoutABroker,
  modules,
  restartsForEachTest = false,
}: {
  environment?: Environment | (() => Environment);
  modules?: readonly ModuleName[];
  restartsForEachTest?: boolean;
} = {}) => {
  const clock = manualClock(new Date());
  const prices = changeablePrices();

  const build = () => {
    const settings = readSettings({
      ...(typeof environment === 'function' ? environment() : environment),
      WORKERS_SCHEDULED: 'false',
      MESSAGING_RETRY_INITIAL_INTERVAL: '20ms',
    });
    const { application, stores, stop } = applicationOf(
      settings,
      { prices, now: clock.now },
      modules,
    );
    const isBroker = settings.messagingBus !== 'none';
    const caughtUp = () =>
      Promise.all(
        application.consumers.map((consumer) =>
          consumer.whenCaughtUp({ timeout: caughtUpWithinMs }),
        ),
      );

    return {
      application,
      stores,
      stop,
      started: application.start(),
      catchUp: async () => {
        const endBefore = await storesEndOf(stores);

        await caughtUp();
        if (isBroker) {
          await delay(brokerSettlingInMs);
          await caughtUp();
        }

        return (await storesEndOf(stores)) !== endBefore;
      },
    };
  };

  let shared: ReturnType<typeof build> | undefined;
  const running = () => (shared ??= build());

  const stopShared = async () => {
    const stopping = shared;

    shared = undefined;
    await stopping?.stop();
  };

  afterAll(stopShared);

  const fetch = (request: Request) => running().application.fetch(request);

  const specification = {
    fetch,
    start: async () => {
      await running().started;
    },
    stop: () => (restartsForEachTest ? stopShared() : Promise.resolve()),
    clock,
    workers: [
      {
        handle: async (now: Date) => {
          for (const worker of running().application.workers)
            await worker.handle(now);
        },
      },
    ],
    sendMessages: async (messages: readonly Message[]) => {
      for (const message of messages)
        await deliverFromOutsideWorld(running().stores, message);
    },
    catchUp: () => running().catchUp(),
  };

  return {
    given: ApiE2ESpecification.for(specification),
    specification,
    fetch,
    clock,
    prices,
    sandboxes: () => running().application.sandboxes,
  };
};

export type ShopTestApplication = ReturnType<typeof shopTestApplication>;
