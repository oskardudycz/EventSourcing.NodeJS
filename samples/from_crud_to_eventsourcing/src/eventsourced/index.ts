import { startAPI } from '#core/api';
import { getPostgres } from '#core/postgres';
import {
  SubscriptionToAllWithPostgresCheckpoints,
  storeCheckpointInPostgres,
} from '#eventsourced/core/subscriptions';
import { router } from './shoppingCarts/routes';
import { projectToShoppingCartItem } from './shoppingCarts/shoppingCartDetails';

//////////////////////////////////////////////////////////
/// Make sure that we dispose Postgres connection pool
//////////////////////////////////////////////////////////

process.once('SIGTERM', () => {
  const db = getPostgres();

  db.dispose().catch((ex) => {
    console.error(ex);
  });
});

//////////////////////////////////////////////////////////
/// API
//////////////////////////////////////////////////////////

startAPI(router);

//////////////////////////////////////////////////////////
/// Run
//////////////////////////////////////////////////////////

(async () => {
  await SubscriptionToAllWithPostgresCheckpoints('sub_shopping_carts', [
    storeCheckpointInPostgres(projectToShoppingCartItem),
  ]);
})();
