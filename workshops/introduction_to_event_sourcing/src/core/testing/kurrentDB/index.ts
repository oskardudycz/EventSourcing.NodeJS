import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    sharedKurrentDBConnectionString: string;
  }
}

export const getKurrentDBConnectionString = (): string =>
  inject('sharedKurrentDBConnectionString');

export const getKurrentDBTestClient = (): KurrentDBClient =>
  KurrentDBClient.connectionString(getKurrentDBConnectionString());
