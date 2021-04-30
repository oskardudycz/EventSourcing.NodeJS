import { EventStoreDBClient } from '@eventstore/db-client';

export function getEventStore(): EventStoreDBClient {
  if (!process.env.ESDB_CONNECTION_STRING) {
    throw 'EventStoreDB conenction string not set. Please define "ESDB_CONNECTION_STRING" environment variable';
  }
  return EventStoreDBClient.connectionString(
    process.env.ESDB_CONNECTION_STRING
  );
}
