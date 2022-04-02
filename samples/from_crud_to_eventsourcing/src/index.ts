import { startAPI } from '#core/api';
import {
  SubscriptionToAllWithMongoCheckpoints,
  storeCheckpointInCollection,
} from '#core/mongoDB';
import { router } from './shoppingCarts/routes';
import { projectToShoppingCartItem } from './shoppingCarts/shoppingCartDetails';

//////////////////////////////////////
/// API
//////////////////////////////////////

startAPI(router);

//////////////////////////////////////
/// Run
//////////////////////////////////////

(async () => {
  await SubscriptionToAllWithMongoCheckpoints('sub_shopping_carts', [
    storeCheckpointInCollection(projectToShoppingCartItem),
  ]);
})();
