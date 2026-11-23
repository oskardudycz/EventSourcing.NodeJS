import {
  getSQLiteEventStore,
  type SQLiteEventStore,
} from '@event-driven-io/emmett-sqlite';
import { sqlite3EventStoreDriver } from '@event-driven-io/emmett-sqlite/sqlite3';
import { projections } from '@event-driven-io/emmett';
import { customerShoppingCartsProjection } from './shoppingCarts/currentCart/customerShoppingCarts';
import { shoppingCartSummariesProjection } from './shoppingCarts/external/shoppingCartSummaries';
import { cartsProjection } from './shoppingCarts/getCart/carts';

export const createEventStore = (fileName: string): SQLiteEventStore =>
  getSQLiteEventStore({
    driver: sqlite3EventStoreDriver,
    fileName,
    projections: projections.inline([
      cartsProjection,
      customerShoppingCartsProjection,
      shoppingCartSummariesProjection,
    ]),
  });
