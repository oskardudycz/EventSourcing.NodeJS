import {
  EmmettError,
  ProblemDocument,
  type AsyncRetryOptions,
} from '@event-driven-io/emmett';
import { getApplication as getHonoApplication } from '@event-driven-io/emmett-honojs';
import {
  sqliteEventStoreConsumer,
  type SQLiteEventStore,
} from '@event-driven-io/emmett-sqlite';
import { sqlite3EventStoreDriver } from '@event-driven-io/emmett-sqlite/sqlite3';
import { pongoClient } from '@event-driven-io/pongo';
import { pongoDriver } from '@event-driven-io/pongo/sqlite3';
import type { MessagingBus } from './messagingBus';
import { customerShoppingCarts } from './shoppingCarts/currentCart/customerShoppingCarts';
import type { ShoppingCartCheckedOutExternal } from './shoppingCarts/external/shoppingCartExternalEvent';
import {
  shoppingCartExternalEventForwarder,
  shoppingCartsExternalForwarderId,
} from './shoppingCarts/external/shoppingCartExternalEventForwarder';
import { shoppingCartSummaries } from './shoppingCarts/external/shoppingCartSummaries';
import { carts } from './shoppingCarts/getCart/carts';
import type { ProductPriceCalculator } from './shoppingCarts/pricing/productPriceCalculator';
import { randomProductPriceCalculator } from './shoppingCarts/pricing/randomProductPriceCalculator';
import type { ShoppingCartEvent } from './shoppingCarts/shoppingCart';
import { shoppingCartFacade } from './shoppingCarts/shoppingCartFacade';
import { shoppingCartsApi } from './shoppingCarts/shoppingCartsApi';

export type ApplicationMessage =
  ShoppingCartEvent | ShoppingCartCheckedOutExternal;

export type ApplicationOptions = {
  eventStore: SQLiteEventStore;
  fileName: string;
  messagingBus: MessagingBus;
  prices?: ProductPriceCalculator;
  now?: () => Date;
  messagingRetry?: AsyncRetryOptions;
};

const mapError = (error: Error) =>
  error instanceof EmmettError &&
  error.status === EmmettError.Codes.IllegalStateError
    ? new ProblemDocument({ detail: error.message, status: 409 })
    : undefined;

export const createApplication = (options: ApplicationOptions) => {
  const {
    eventStore,
    fileName,
    messagingBus,
    prices = randomProductPriceCalculator(),
    now = () => new Date(),
  } = options;

  const pongo = pongoClient({
    driver: pongoDriver,
    connectionString: fileName,
    schema: { autoMigration: 'None' },
  });
  const shutdown = new AbortController();
  const consumer = sqliteEventStoreConsumer<
    ApplicationMessage,
    typeof sqlite3EventStoreDriver
  >({
    driver: sqlite3EventStoreDriver,
    fileName,
    pulling: { pullingFrequencyInMs: 20 },
  });

  consumer.reactor<ShoppingCartEvent>({
    processorId: shoppingCartsExternalForwarderId,
    canHandle: ['shopping_carts.ShoppingCartCheckedOut'],
    eachMessage: shoppingCartExternalEventForwarder({
      messagingBus,
      summaries: shoppingCartSummaries(pongo),
      retry: options.messagingRetry,
      signal: shutdown.signal,
    }),
  });

  const customerCarts = customerShoppingCarts(pongo);
  const app = getHonoApplication({
    mapError,
    apis: [
      shoppingCartsApi({
        shoppingCarts: shoppingCartFacade({
          eventStore,
          customerShoppingCarts: customerCarts,
          prices,
          now,
        }),
        customerShoppingCarts: customerCarts,
        carts: carts(pongo),
      }),
    ],
  });

  let running: Promise<void> = Promise.resolve();

  return {
    fetch: (request: Request): Response | Promise<Response> =>
      app.fetch(request),
    consumer,
    start: async () => {
      await eventStore.schema.migrate();
      running = consumer.start();
      await consumer.whenStarted();
    },
    stop: async () => {
      shutdown.abort();
      await consumer.close();
      await pongo.close();
      await eventStore.close();
      await running;
    },
  };
};

export type Application = ReturnType<typeof createApplication>;
