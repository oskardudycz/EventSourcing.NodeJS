import { disconnectFromPostgres, runPostgresMigrations } from '#core/postgres';
import { getApplication, startAPI } from '@event-driven-io/emmett-expressjs';
import { disconnectFromEventStore, getEventStore } from './core/eventStore';
import { shoppingCartApi } from './shoppingCarts/api';
import { getPricedProductItem } from './shoppingCarts/productItem';
import { getUserData } from './shoppingCarts/user';

//////////////////////////////////////////////////////////
/// Make sure that we dispose Postgres connection pool
//////////////////////////////////////////////////////////

process.once('SIGTERM', disconnectFromPostgres);
process.once('SIGTERM', disconnectFromEventStore);

//////////////////////////////////////////////////////////
/// API
//////////////////////////////////////////////////////////

await runPostgresMigrations();

const application = getApplication({
  apis: [
    shoppingCartApi(
      getEventStore(),
      getPricedProductItem,
      getUserData,
      () => new Date(),
    ),
  ],
});

startAPI(application, { port: 5000 });
