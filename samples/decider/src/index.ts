import { startAPI } from '#core/api';
import {
  SubscriptionToAllWithMongoCheckpoints,
  storeCheckpointInCollection,
} from '#core/mongoDB';
import { router } from './shoppingCarts/routes';
import { projectToShoppingCartDetails } from './shoppingCarts/shoppingCartDetails';
import { projectToClientShoppingHistory } from './shoppingCarts/clientShoppingHistory';
import { disconnectFromEventStore } from '#core/streams';

process.once('SIGTERM', disconnectFromEventStore);

////////////////////////////////////
// API
////////////////////////////////////

startAPI(router);

////////////////////////////////////
// Run
////////////////////////////////////

(async () => {
  await SubscriptionToAllWithMongoCheckpoints('sub_shopping_carts', [
    storeCheckpointInCollection(
      projectToShoppingCartDetails,
      projectToClientShoppingHistory
    ),
  ]);
})().catch(console.error);
