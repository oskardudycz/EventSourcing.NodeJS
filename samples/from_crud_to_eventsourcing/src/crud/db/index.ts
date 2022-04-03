import createConnectionPool, { sql } from '@databases/pg';
import tables from '@databases/pg-typed';
import DatabaseSchema from './__generated__';

export { sql };

const db = createConnectionPool();
export default db;

const { cart: carts, cart_item: cartItems } = tables<DatabaseSchema>({
  databaseSchema: require('./__generated__/schema.json'),
});
export { carts, cartItems };
