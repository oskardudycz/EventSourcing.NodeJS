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
import {
  createApplication,
  type ApplicationMessage,
  type ModuleName,
} from './application';
import { channelStoreOf } from './channelStores';
import {
  conflictingEventStore,
  type ConflictingEventStore,
} from './conflictingEventStore';
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
  signal?: AbortSignal;
};

export const testApplication = ({
  messagingBus = 'in-memory',
  internalDelivery,
  publishedTypes = shoppingCartsPublishedTypes,
  modules = ['shopping_carts', 'orders'],
  signal,
}: TestApplicationOptions = {}) => {
  const prices = changeablePrices();
  const clock = manualClock(new Date('2026-01-01T10:00:00.000Z'));
  const provider = paymentProvider();
  const stock = warehouse();
  const logLines: string[] = [];
  const logger = pino(
    { level: 'info' },
    {
      write: (line: string) => {
        logLines.push(line);
      },
    },
  );
  let folder = '';
  let stores: ModuleStores | undefined;
  let eventStoreInUse: ConflictingEventStore | undefined;

  const given = ApiE2ESpecification.for({
    getEventStore: () => {
      folder = temporarySQLiteFolder();
      stores = createModuleStores({ type: 'sqlite', folder }, messagingBus, {
        pullingFrequencyInMs: 20,
        batchSize: 1,
      });
      eventStoreInUse = conflictingEventStore(stores.shoppingCarts.store);
      return eventStoreInUse;
    },
    getApplication: (eventStore) => {
      const modulesStores = stores;

      if (!modulesStores) throw new Error('The module stores are not created');

      const orders = recordingAppends(modulesStores.orders);
      const payments = recordingAppends(modulesStores.payments);
      const shipments = recordingAppends(modulesStores.shipments);
      const broker =
        modulesStores.messagingBus === 'in-memory'
          ? recordingAppends(modulesStores.broker)
          : undefined;
      const recordedStores: ModuleStores = {
        ...modulesStores,
        shoppingCarts: { ...modulesStores.shoppingCarts, store: eventStore },
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
      const sources = storesOf(modulesStores).map((database) =>
        database.messageSource(),
      );
      const storesEnd = async () =>
        (
          await Promise.all(
            sources.map((source) => source.readLastMessageCheckpoint()),
          )
        ).join();
      let stopping: Promise<void> | undefined;
      const stop = () => {
        stopping ??= application
          .stop()
          .then(() => removeSQLiteFolder(folder));

        return stopping;
      };

      signal?.addEventListener('abort', () => void stop());

      return {
        fetch: application.fetch,
        start: application.start,
        sendMessages: async (messages) => {
          for (const message of messages)
            await deliverFromOutsideWorld(recordedStores, message);
        },
        workers: application.workers,
        stop,
        catchUp: async () => {
          if (signal?.aborted) return false;

          const endBefore = await storesEnd();
          const caughtUp = () =>
            Promise.all(
              application.consumers.map((consumer) =>
                consumer.whenCaughtUp({ timeout: 10_000 }),
              ),
            );

          await caughtUp();
          await caughtUp();

          return (await storesEnd()) !== endBefore && !signal?.aborted;
        },
        clock,
        published: collectPublished,
      };
    },
  });

  const priceOf = (productId: string, unitPrice: number): ActionStep =>
    action(() => prices.setPriceOf(productId, unitPrice));

  const appendsConflict = (count: number): ActionStep =>
    action(() => eventStoreInUse?.conflictsOnTheNextAppends(count));

  return {
    given,
    prices,
    clock,
    priceOf,
    appendsConflict,
    paymentProvider: provider,
    warehouse: stock,
    logs: () => logLines,
  };
};
