import { startAPI } from '#core/api';
import { disconnectFromPostgres } from '#core/postgres';
import { disconnectFromEventStore } from '#eventsourced/core/streams';
import { router } from './shoppingCarts/routes';

//////////////////////////////////////////////////////////
/// Make sure that we dispose Postgres connection pool
//////////////////////////////////////////////////////////

process.once('SIGTERM', disconnectFromPostgres);
process.once('SIGTERM', disconnectFromEventStore);

//////////////////////////////////////////////////////////
/// API
//////////////////////////////////////////////////////////

startAPI(router);
