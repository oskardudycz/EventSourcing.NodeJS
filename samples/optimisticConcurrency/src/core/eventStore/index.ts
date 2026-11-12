import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { config } from '#config';

let eventStore: KurrentDBClient;

export function getEventStore(): KurrentDBClient {
  if (!config.kurrentDB.connectionString) {
    throw new Error(
      'KurrentDB connection string not set. Please define "KURRENTDB_CONNECTION_STRING" environment variable',
    );
  }

  if (!eventStore) {
    eventStore = KurrentDBClient.connectionString(
      config.kurrentDB.connectionString,
    );
  }

  return eventStore;
}
