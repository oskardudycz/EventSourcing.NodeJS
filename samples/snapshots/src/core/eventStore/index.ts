import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { config } from '../../../config';

export function getEventStore(): KurrentDBClient {
  if (!config.kurrentDB.connectionString) {
    throw new Error(
      'KurrentDB conenction string not set. Please define "KURRENTDB_CONNECTION_STRING" environment variable',
    );
  }

  return KurrentDBClient.connectionString(config.kurrentDB.connectionString);
}
