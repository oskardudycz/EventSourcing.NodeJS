import tables from '@databases/pg-typed';
import DatabaseSchema from './__generated__';

const {
  cart: carts,
  cart_item: cartItems,
  subscription_checkpoint: subscriptionCheckpoints,
} = tables<DatabaseSchema>({
  databaseSchema: require('./__generated__/schema.json'),
});
export { carts, cartItems, subscriptionCheckpoints };
