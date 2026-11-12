import { EventStoreDBClient } from '@eventstore/db-client';
import { inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    sharedEventStoreDBConnectionString: string;
  }
}

export const getEventStoreDBTestClient = (): EventStoreDBClient =>
  EventStoreDBClient.connectionString(
    inject('sharedEventStoreDBConnectionString'),
  );
