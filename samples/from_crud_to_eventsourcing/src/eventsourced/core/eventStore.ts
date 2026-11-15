//////////////////////////////////////
/// Emmett PostgreSQL event store
//////////////////////////////////////

import { config } from '#config';
import { projections } from '@event-driven-io/emmett';
import type { PostgresEventStore } from '@event-driven-io/emmett-postgresql';
import { getPostgreSQLEventStore } from '@event-driven-io/emmett-postgresql';
import { shoppingCartDetailsProjection } from '../shoppingCarts/shoppingCartDetails';

let eventStore: PostgresEventStore | undefined;

export function getEventStore(): PostgresEventStore {
  if (!config.postgres.connectionString) {
    throw new Error(
      'Postgres connection string not set. Please define "DATABASE_URL" environment variable',
    );
  }

  eventStore ??= getPostgreSQLEventStore(config.postgres.connectionString, {
    projections: projections.inline([shoppingCartDetailsProjection]),
  });

  return eventStore;
}

export const disconnectFromEventStore = async () => {
  if (!eventStore) return;

  const current = eventStore;
  eventStore = undefined;

  try {
    await current.close();
  } catch (ex) {
    console.error(ex);
  }
};
