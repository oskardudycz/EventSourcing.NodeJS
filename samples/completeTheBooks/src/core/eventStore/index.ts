import { EventStoreDBClient } from '@eventstore/db-client';
import { config } from '#config';

export function getEventStore(): EventStoreDBClient {
  if (!config.eventStoreDB.connectionString) {
    throw 'EventStoreDB connection string not set. Please define "ESDB_CONNECTION_STRING" environment variable';
  }

  return EventStoreDBClient.connectionString(
    config.eventStoreDB.connectionString
  );
}
