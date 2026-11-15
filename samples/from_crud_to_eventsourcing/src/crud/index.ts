import { startAPI } from '#core/api';
import { disconnectFromPostgres, runPostgresMigrations } from '#core/postgres';
import { shoppingCartsRouter } from './shoppingCarts/routes';

//////////////////////////////////////////////////////////
/// Make sure that we dispose Postgres connection pool
//////////////////////////////////////////////////////////

process.once('SIGTERM', disconnectFromPostgres);

//////////////////////////////////////////////////////////
/// API
//////////////////////////////////////////////////////////

await runPostgresMigrations();

startAPI(shoppingCartsRouter(() => new Date()));
