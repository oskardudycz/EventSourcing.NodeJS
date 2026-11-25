import { projections, type MessageSource } from '@event-driven-io/emmett';
import {
  getPostgreSQLEventStore,
  type PostgresEventStore,
  postgreSQLEventStoreConsumer,
  postgreSQLMessageSource,
  type PostgresEventStoreOptions,
} from '@event-driven-io/emmett-postgresql';
import { pgEventStoreDriver } from '@event-driven-io/emmett-postgresql/pg';
import {
  getSQLiteEventStore,
  type SQLiteEventStore,
  sqliteEventStoreConsumer,
  sqliteMessageSource,
  type SQLiteEventStoreConsumerConfig,
  type SQLiteEventStoreOptions,
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
  projectingConsumer: () => ModuleConsumer | undefined;
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

export type ModuleProjections = {
  sqlite: () => NonNullable<SQLiteEventStoreOptions['projections']>;
  postgresql: () => NonNullable<PostgresEventStoreOptions['projections']>;
};

const noProjections: ModuleProjections = {
  sqlite: () => [],
  postgresql: () => [],
};

type DatabaseOptions = {
  name: string;
  projections: ModuleProjections;
  pulling?: Pulling;
};

const hasAsyncProjections = (registrations: { type: string }[]) =>
  registrations.some(({ type }) => type === 'async');

const sqliteDatabaseOf = (
  folder: string,
  { name, projections: moduleProjections, pulling }: DatabaseOptions,
): Database => {
  const fileName = `${folder}/${name}.db`;
  const registrations = moduleProjections.sqlite();
  const store = getSQLiteEventStore({
    driver: sqlite3EventStoreDriver,
    fileName,
    schema: { autoMigration: 'None' },
    projections: registrations,
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
      readingFrom
        ? sqliteEventStoreConsumer<
            ApplicationMessage,
            typeof sqlite3EventStoreDriver
          >({
            driver: sqlite3EventStoreDriver,
            fileName,
            schema: { autoMigration: 'None' },
            source: readingFrom.messageSource(),
            pulling,
          })
        : store.consumer<ApplicationMessage>({ pulling }),
    projectingConsumer: () =>
      hasAsyncProjections(registrations)
        ? store.consumer<ApplicationMessage>({
            pulling,
            includeAsyncProjections: true,
          })
        : undefined,
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

const postgreSQLDatabaseOf = (
  connectionString: string,
  { name, projections: moduleProjections, pulling }: DatabaseOptions,
): Database => {
  const registrations = moduleProjections.postgresql();
  const store = getPostgreSQLEventStore({
    driver: pgEventStoreDriver,
    connectionString,
    schema: { databaseSchemaName: name, autoMigration: 'None' },
    projections: registrations,
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
      readingFrom
        ? postgreSQLEventStoreConsumer<ApplicationMessage>({
            driver: pgEventStoreDriver,
            connectionString,
            schema: { databaseSchemaName: name, autoMigration: 'None' },
            source: readingFrom.messageSource(),
            pulling,
          })
        : store.consumer<ApplicationMessage>({ pulling }),
    projectingConsumer: () =>
      hasAsyncProjections(registrations)
        ? store.consumer<ApplicationMessage>({
            pulling,
            includeAsyncProjections: true,
          })
        : undefined,
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

const databaseOf = (location: EventStoreLocation, options: DatabaseOptions) =>
  location.type === 'sqlite'
    ? sqliteDatabaseOf(location.folder, options)
    : postgreSQLDatabaseOf(location.connectionString, options);

export const createModuleStores = (
  location: EventStoreLocation,
  messagingBus: MessagingBus,
  pulling?: Pulling,
): ModuleStores => {
  const database = (
    name: string,
    moduleProjections: ModuleProjections = noProjections,
  ) => databaseOf(location, { name, projections: moduleProjections, pulling });
  const shared = {
    location,
    shoppingCarts: database('shopping_carts', {
      sqlite: () =>
        projections.inline([
          cartsReadModel.sqlite(),
          customerShoppingCartsReadModel.sqlite(),
          shoppingCartSummariesReadModel.sqlite(),
        ]),
      postgresql: () =>
        projections.inline([
          cartsReadModel.postgresql(),
          customerShoppingCartsReadModel.postgresql(),
          shoppingCartSummariesReadModel.postgresql(),
        ]),
    }),
    orders: database('orders', {
      sqlite: () =>
        projections.async([
          orderStatusesReadModel.sqlite(),
          customerOrdersReadModel.sqlite(),
          ordersAwaitingPaymentReadModel.sqlite(),
        ]),
      postgresql: () =>
        projections.async([
          orderStatusesReadModel.postgresql(),
          customerOrdersReadModel.postgresql(),
          ordersAwaitingPaymentReadModel.postgresql(),
        ]),
    }),
    payments: database('payments', {
      sqlite: () =>
        projections.async([
          pendingPaymentsReadModel.sqlite(),
          authorizedPaymentsReadModel.sqlite(),
        ]),
      postgresql: () =>
        projections.async([
          pendingPaymentsReadModel.postgresql(),
          authorizedPaymentsReadModel.postgresql(),
        ]),
    }),
    shipments: database('shipments'),
  };

  return messagingBus === 'in-memory'
    ? { ...shared, messagingBus, broker: database('broker') }
    : { ...shared, messagingBus };
};

export const storesOf = (stores: ModuleStores): Database[] => [
  stores.shoppingCarts,
  stores.orders,
  stores.payments,
  stores.shipments,
  ...(stores.messagingBus === 'in-memory' ? [stores.broker] : []),
];
