import {
  action,
  ApiE2ESpecification,
  appendToChannelStream,
  channelStreamName,
  channelStreamPrefix,
  manualClock,
  messageRouter,
  removeSQLiteFolder,
  temporarySQLiteFolder,
  type ActionStep,
  type ForwardedMessage,
  type PublishedMessage,
} from '@e-commerce/core';
import {
  WrapEventStore,
  type Event,
  type Message,
} from '@event-driven-io/emmett';
import pino from 'pino';
import { afterAll } from 'vitest';
import { createApplication, type ModuleName } from './application';
import { channelStoreOf } from './channelStores';
import { conflictingEventStore } from './conflictingEventStore';
import {
  createModuleStores,
  storesOf,
  type Database,
  type ModuleStores,
} from './eventStore';
import type { InternalDelivery } from './settings';
import { orderRequestTypes } from './orders/orderWorkflow';
import {
  paymentAnswerTypes,
  type PaymentAnswer,
} from './payments/paymentCommand';
import { paymentProvider } from './payments/paymentProvider';
import { paymentWorkflowInbox } from './payments/paymentWorkflow';
import {
  paymentsChannels,
  paymentsRequestRoutes,
  paymentsResponseRoutes,
} from './payments/paymentsConfig';
import {
  shipmentAnswerTypes,
  type ShipmentAnswer,
} from './shipments/shipmentCommand';
import { shipmentWorkflowInbox } from './shipments/shipmentWorkflow';
import {
  shipmentsChannels,
  shipmentsRequestRoutes,
  shipmentsResponseRoutes,
} from './shipments/shipmentsConfig';
import { warehouse } from './shipments/warehouse';
import { changeablePrices } from './shoppingCarts/pricing/changeablePrices';
import {
  shoppingCartsChannels,
  shoppingCartsRoutes,
} from './shoppingCarts/shoppingCartsConfig';

export const testedMessagingBuses = ['in-memory', 'none'] as const;

export type TestedMessagingBus = (typeof testedMessagingBuses)[number];

export const shoppingCartsPublishedTypes: readonly string[] = [
  'shopping_carts.external.ShoppingCartCheckedOut',
];

export const ordersPublishedTypes: readonly string[] = orderRequestTypes;

const outsideWorldRouter = messageRouter<{ type: string }>(
  [
    shoppingCartsRoutes,
    paymentsRequestRoutes,
    paymentsResponseRoutes,
    shipmentsRequestRoutes,
    shipmentsResponseRoutes,
  ],
  [...shoppingCartsChannels, ...paymentsChannels, ...shipmentsChannels],
);

const storeInPaymentInbox = paymentWorkflowInbox(() => new Date());
const storeInShipmentInbox = shipmentWorkflowInbox(() => new Date());

const isPaymentAnswer = (message: Message): message is PaymentAnswer =>
  paymentAnswerTypes.some((type) => type === message.type);

const isShipmentAnswer = (message: Message): message is ShipmentAnswer =>
  shipmentAnswerTypes.some((type) => type === message.type);

const messageIdOf = (message: Message): string =>
  'metadata' in message &&
  typeof message.metadata === 'object' &&
  message.metadata !== null &&
  'messageId' in message.metadata &&
  typeof message.metadata.messageId === 'string'
    ? message.metadata.messageId
    : crypto.randomUUID();

export const deliverFromOutsideWorld = async (
  stores: ModuleStores,
  message: Message,
) => {
  if (isPaymentAnswer(message)) {
    await storeInPaymentInbox(stores.payments.store, message);
    return;
  }

  if (isShipmentAnswer(message)) {
    await storeInShipmentInbox(stores.shipments.store, message);
    return;
  }

  const forwarded: ForwardedMessage<Event> = {
    type: message.type,
    data: message.data,
    metadata: { messageId: messageIdOf(message) },
  };
  const { channel, key } = outsideWorldRouter.declaredRouteFor(forwarded);

  await appendToChannelStream(
    channelStoreOf(stores)(channel),
    channelStreamName(channel),
    forwarded,
    key,
  );
};

const recordingAppends = (database: Database) => {
  const store = WrapEventStore(database.store);

  return {
    database: { ...database, store },
    appendedEvents: store.appendedEvents,
  };
};

const keyOf = (event: object): string | undefined =>
  'metadata' in event &&
  typeof event.metadata === 'object' &&
  event.metadata !== null &&
  'key' in event.metadata &&
  typeof event.metadata.key === 'string'
    ? event.metadata.key
    : undefined;

export type TestApplicationOptions = {
  messagingBus?: TestedMessagingBus;
  internalDelivery?: InternalDelivery;
  publishedTypes?: readonly string[];
  modules?: readonly ModuleName[];
};

const mentionsAnyOf =
  (ids: readonly string[]) =>
  (message: unknown): boolean => {
    const text = JSON.stringify(message);

    return ids.some((id) => text.includes(id));
  };

export const testApplication = ({
  messagingBus = 'in-memory',
  internalDelivery,
  publishedTypes = shoppingCartsPublishedTypes,
  modules = ['shopping_carts', 'orders'],
}: TestApplicationOptions = {}) => {
  const prices = changeablePrices();
  const clock = manualClock(new Date());
  const provider = paymentProvider();
  const stock = warehouse();
  const logLines: string[] = [];
  let firstLogLineOfTheTest = 0;
  const logger = pino(
    { level: 'info' },
    {
      write: (line: string) => {
        logLines.push(line);
      },
    },
  );

  const build = () => {
    const folder = temporarySQLiteFolder();
    const stores = createModuleStores(
      { type: 'sqlite', folder },
      messagingBus,
      {
        pullingFrequencyInMs: 20,
        batchSize: 1,
      },
    );
    const shoppingCartsStore = conflictingEventStore(
      stores.shoppingCarts.store,
    );
    const shoppingCarts = WrapEventStore(shoppingCartsStore);
    const orders = recordingAppends(stores.orders);
    const payments = recordingAppends(stores.payments);
    const shipments = recordingAppends(stores.shipments);
    const broker =
      stores.messagingBus === 'in-memory'
        ? recordingAppends(stores.broker)
        : undefined;
    const recordedStores: ModuleStores = {
      ...stores,
      shoppingCarts: { ...stores.shoppingCarts, store: shoppingCarts },
      orders: orders.database,
      payments: payments.database,
      shipments: shipments.database,
      ...(broker ? { broker: broker.database } : {}),
    };
    const appended = [orders, payments, shipments, broker].filter(
      (recording) => recording !== undefined,
    );
    const application = createApplication(
      {
        stores: recordedStores,
        internalDelivery,
        prices,
        now: clock.now,
        messagingRetry: { minTimeout: 5, maxTimeout: 50 },
        paymentGateway: provider,
        warehouse: stock,
        logger,
      },
      { modules },
    );
    const published: PublishedMessage[] = [];
    const publishedCounts = new Map<string, number>();
    const collectPublished = () => {
      appended.forEach(({ appendedEvents }, index) => {
        for (const [streamName, [, events]] of appendedEvents) {
          if (!streamName.startsWith(channelStreamPrefix)) continue;

          const countKey = `${index}:${streamName}`;

          published.push(
            ...events
              .slice(publishedCounts.get(countKey) ?? 0)
              .filter(({ type }) => publishedTypes.includes(type))
              .map((event) => ({
                type: event.type,
                data: event.data,
                metadata: { key: keyOf(event) },
              })),
          );
          publishedCounts.set(countKey, events.length);
        }
      });

      return published;
    };
    const sources = storesOf(stores).map((database) =>
      database.messageSource(),
    );
    const storesEnd = async () => {
      const ends: (string | null)[] = [];

      for (const source of sources)
        ends.push(await source.readLastMessageCheckpoint());

      return ends.join();
    };
    const caughtUp = () =>
      Promise.all(
        application.consumers.map((consumer) =>
          consumer.whenCaughtUp({ timeout: 10_000 }),
        ),
      );

    return {
      application,
      shoppingCartsStore,
      appendedEvents: shoppingCarts.appendedEvents,
      started: application.start(),
      stop: () => application.stop().then(() => removeSQLiteFolder(folder)),
      sendMessages: async (messages: readonly Message[]) => {
        for (const message of messages)
          await deliverFromOutsideWorld(recordedStores, message);
      },
      catchUp: async () => {
        const endBefore = await storesEnd();

        await caughtUp();
        await caughtUp();

        return (await storesEnd()) !== endBefore;
      },
      published: collectPublished,
    };
  };

  let shared: ReturnType<typeof build> | undefined;
  const running = () => (shared ??= build());

  afterAll(async () => {
    await shared?.stop();
  });

  const specificationAbout = (isAbout?: (message: unknown) => boolean) => {
    const application = running();

    return ApiE2ESpecification.for({
      fetch: application.application.fetch,
      start: async () => {
        await application.started;
        firstLogLineOfTheTest = logLines.length;
      },
      sendMessages: application.sendMessages,
      workers: application.application.workers,
      catchUp: application.catchUp,
      clock,
      published: application.published,
      appendedEvents: application.appendedEvents,
      ...(isAbout ? { isAbout } : {}),
    });
  };

  const given: ApiE2ESpecification = (...steps) =>
    specificationAbout()(...steps);

  const priceOf = (productId: string, unitPrice: number): ActionStep =>
    action(() => prices.setPriceOf(productId, unitPrice));

  const appendsConflict = (count: number): ActionStep =>
    action(() => running().shoppingCartsStore.conflictsOnTheNextAppends(count));

  const logs = (isAbout: (line: string) => boolean = () => true) =>
    logLines.slice(firstLogLineOfTheTest).filter(isAbout);

  const helpers = {
    prices,
    clock,
    priceOf,
    appendsConflict,
    paymentProvider: provider,
    warehouse: stock,
  };

  return {
    ...helpers,
    given,
    logs: () => logs(),
    about: (...ids: string[]) => {
      const isAbout = mentionsAnyOf(ids);
      const about: ApiE2ESpecification = (...steps) =>
        specificationAbout(isAbout)(...steps);

      return { ...helpers, given: about, logs: () => logs(isAbout) };
    },
  };
};
