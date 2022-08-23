import createConnectionPool, { sql } from '@databases/pg';
import tables from '@databases/pg-typed';
import DatabaseSchema from './__generated__';
import databaseSchema from './__generated__/schema.json';

export { sql };
export { carts, cartItems };

const db = createConnectionPool();
export default db;

const { cart: carts, cart_item: cartItems } = tables<DatabaseSchema>({
  databaseSchema,
});
