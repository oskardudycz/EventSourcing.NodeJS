import { startAPI } from '#core/api';
import {
  SubscriptionToAllWithMongoCheckpoints,
  getMongoDB,
} from '#core/mongoDB';
import { router } from './shoppingCarts/routes';
import { projectToShoppingCartDetails } from './shoppingCarts/shoppingCartDetails/shoppingCartDetails';
import { projectToClientShoppingHistory } from './shoppingCarts/clientShoppingHistory/clientShoppingHistory';
import { disconnectFromEventStore, getEventStore } from '#core/streams';

process.once('SIGTERM', disconnectFromEventStore);

////////////////////////////////////
// API
////////////////////////////////////

startAPI(router);

////////////////////////////////////
// Run
////////////////////////////////////

(async () => {
  const eventStore = getEventStore();
  const mongo = await getMongoDB();

  await SubscriptionToAllWithMongoCheckpoints(eventStore, mongo)(
    'sub_shopping_carts',
    [
      async (event) => {
        await projectToShoppingCartDetails(mongo)(event);
      },
      async (event) => {
        await projectToClientShoppingHistory(mongo)(event);
      },
    ],
  );
})().catch(console.error);
