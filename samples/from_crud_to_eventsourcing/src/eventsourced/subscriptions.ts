import {
  handleEventInPostgresTransactionScope,
  SubscriptionToAllWithPostgresCheckpoints,
} from './core/subscriptions';
import { projectToShoppingCartItem } from './shoppingCarts/shoppingCartDetails';

export const runSubscription = () =>
  SubscriptionToAllWithPostgresCheckpoints('sub_shopping_carts', [
    handleEventInPostgresTransactionScope([projectToShoppingCartItem]),
  ]);
