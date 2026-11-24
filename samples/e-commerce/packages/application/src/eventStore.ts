import {
  projections,
  type Event,
  type MessageSource,
} from '@event-driven-io/emmett';
import {
  getPostgreSQLEventStore,
  type PostgresEventStore,
  postgreSQLEventStoreConsumer,
  postgreSQLMessageSource,
} from '@event-driven-io/emmett-postgresql';
import { pgEventStoreDriver } from '@event-driven-io/emmett-postgresql/pg';
import {
  getSQLiteEventStore,
  type SQLiteEventStore,
  sqliteEventStoreConsumer,
  sqliteMessageSource,
  type SQLiteEventStoreConsumerConfig,
} from '@event-driven-io/emmett-sqlite';
import { sqlite3EventStoreDriver } from '@event-driven-io/emmett-sqlite/sqlite3';
import { dumbo } from '@event-driven-io/dumbo';
import { pgDumboDriver } from '@event-driven-io/dumbo/pg';
import { sqlite3DumboDriver } from '@event-driven-io/dumbo/sqlite3';
import { pongoClient, type PongoClient } from '@event-driven-io/pongo';
import { pongoDriver as pgPongoDriver } from '@event-driven-io/pongo/pg';
import { pongoDriver as sqlitePongoDriver } from '@event-driven-io/pongo/sqlite3';
import type { ApplicationMessage } from './application';
import type { MessagingBus } from './messagingBus';
import type { ModuleConsumer } from './moduleConsumer';
import { customerOrdersReadModel } from './orders/getCustomerOrders/customerOrders';
import { orderStatusesReadModel } from './orders/getOrderStatus/orderStatuses';
import { ordersAwaitingPaymentReadModel } from './orders/unpaid/ordersAwaitingPayment';
import { authorizedPaymentsReadModel } from './payments/authorization/authorizedPayments';
import { pendingPaymentsReadModel } from './payments/authorization/pendingPayments';
import { paymentSummariesReadModel } from './payments/external/paymentSummaries';
import type { ReadModel } from './readModelProjection';
import { shipmentSummariesReadModel } from './shipments/external/shipmentSummaries';
import { customerShoppingCartsReadModel } from './shoppingCarts/currentCart/customerShoppingCarts';
import { shoppingCartSummariesReadModel } from './shoppingCarts/external/shoppingCartSummaries';
import { cartsReadModel } from './shoppingCarts/getCart/carts';

export type EventStoreType = 'sqlite' | 'postgresql';

export type EventStoreLocation =
  | { type: 'sqlite'; folder: string }
  | { type: 'postgresql'; connectionString: string };

export type Pulling = SQLiteEventStoreConsumerConfig['pulling'];

export type ModuleStore = SQLiteEventStore | PostgresEventStore;

export type Database = {
  name: string;
  store: ModuleStore;
  consumer: (readingFrom?: Database) => ModuleConsumer;
  messageSource: () => MessageSource;
  pongo: () => PongoClient;
  close: () => Promise<void>;
};

export type ModuleStores = {
  location: EventStoreLocation;
  shoppingCarts: Database;
  orders: Database;
  payments: Database;
  shipments: Database;
} & (
  | { messagingBus: 'in-memory'; broker: Database }
  | { messagingBus: 'none' }
  | { messagingBus: 'kafka' | 'rabbitmq' }
);

type DatabaseOptions<EventType extends Event> = {
  name: string;
  readModels: ReadModel<EventType>[];
  pulling?: Pulling;
};

const sqliteDatabaseOf = <EventType extends Event>(
  folder: string,
  { name, readModels, pulling }: DatabaseOptions<EventType>,
): Database => {
  const fileName = `${folder}/${name}.db`;
  const store = getSQLiteEventStore({
    driver: sqlite3EventStoreDriver,
    fileName,
    projections: projections.inline(readModels.map((model) => model.sqlite())),
  });
  let pool: ReturnType<typeof newPool> | undefined;
  const newPool = () => dumbo({ driver: sqlite3DumboDriver, fileName });
  const ownPool = () => (pool ??= newPool());
  const messageSource = () => sqliteMessageSource({ pool: ownPool() });
  const pongos: PongoClient[] = [];

  return {
    name,
    store,
    messageSource,
    consumer: (readingFrom) =>
      sqliteEventStoreConsumer<
        ApplicationMessage,
        typeof sqlite3EventStoreDriver
      >({
        driver: sqlite3EventStoreDriver,
        fileName,
        source: readingFrom?.messageSource(),
        pulling,
      }),
    pongo: () => {
      const client = pongoClient({
        driver: sqlitePongoDriver,
        connectionString: fileName,
        schema: { autoMigration: 'None' },
      });
      pongos.push(client);
      return client;
    },
    close: async () => {
      await Promise.all(pongos.map((client) => client.close()));
      await pool?.close();
      await store.close();
    },
  };
};

const postgreSQLDatabaseOf = <EventType extends Event>(
  connectionString: string,
  { name, readModels, pulling }: DatabaseOptions<EventType>,
): Database => {
  const store = getPostgreSQLEventStore({
    driver: pgEventStoreDriver,
    connectionString,
    schema: { databaseSchemaName: name },
    projections: projections.inline(
      readModels.map((model) => model.postgresql()),
    ),
  });
  let pool: ReturnType<typeof newPool> | undefined;
  const newPool = () => dumbo({ driver: pgDumboDriver, connectionString });
  const ownPool = () => (pool ??= newPool());
  const messageSource = () =>
    postgreSQLMessageSource({ pool: ownPool(), databaseSchemaName: name });
  const pongos: PongoClient[] = [];

  return {
    name,
    store,
    messageSource,
    consumer: (readingFrom) =>
      postgreSQLEventStoreConsumer<ApplicationMessage>({
        driver: pgEventStoreDriver,
        connectionString,
        schema: { databaseSchemaName: name },
        source: readingFrom?.messageSource(),
        pulling,
      }),
    pongo: () => {
      const client = pongoClient({
        driver: pgPongoDriver,
        connectionString,
        defaultSchemaName: name,
        schema: { autoMigration: 'None' },
      });
      pongos.push(client);
      return client;
    },
    close: async () => {
      await Promise.all(pongos.map((client) => client.close()));
      await pool?.close();
      await store.close();
    },
  };
};

const databaseOf = <EventType extends Event>(
  location: EventStoreLocation,
  options: DatabaseOptions<EventType>,
) =>
  location.type === 'sqlite'
    ? sqliteDatabaseOf(location.folder, options)
    : postgreSQLDatabaseOf(location.connectionString, options);

export const createModuleStores = (
  location: EventStoreLocation,
  messagingBus: MessagingBus,
  pulling?: Pulling,
): ModuleStores => {
  const database = <EventType extends Event>(
    name: string,
    readModels: ReadModel<EventType>[],
  ) => databaseOf(location, { name, readModels, pulling });
  const shared = {
    location,
    shoppingCarts: database('shopping_carts', [
      cartsReadModel,
      customerShoppingCartsReadModel,
      shoppingCartSummariesReadModel,
    ]),
    orders: database('orders', [
      orderStatusesReadModel,
      customerOrdersReadModel,
      ordersAwaitingPaymentReadModel,
    ]),
    payments: database('payments', [
      paymentSummariesReadModel,
      pendingPaymentsReadModel,
      authorizedPaymentsReadModel,
    ]),
    shipments: database('shipments', [shipmentSummariesReadModel]),
  };

  return messagingBus === 'in-memory'
    ? { ...shared, messagingBus, broker: database('broker', []) }
    : { ...shared, messagingBus };
};

export const storesOf = (stores: ModuleStores): Database[] => [
  stores.shoppingCarts,
  stores.orders,
  stores.payments,
  stores.shipments,
  ...(stores.messagingBus === 'in-memory' ? [stores.broker] : []),
];
