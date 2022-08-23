import tables from '@databases/pg-typed';
import DatabaseSchema from './__generated__';
import databaseSchema from './__generated__/schema.json';

const {
  cart: carts,
  cart_item: cartItems,
  subscription_checkpoint: subscriptionCheckpoints,
} = tables<DatabaseSchema>({
  databaseSchema,
});
export { carts, cartItems, subscriptionCheckpoints };
