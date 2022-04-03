//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

import createConnectionPool, { ConnectionPool } from '@databases/pg';
import { config } from '#config';
import { DEFAULT_RETRY_OPTIONS, RetryOptions, retryPromise } from './retries';

let db: ConnectionPool;

export const getPostgres = (): ConnectionPool => {
  if (!config.postgres.connectionString) {
    throw 'Postgres connection string not set. Please define "DATABASE_URL" environment variable';
  }

  if (!db) {
    db = createConnectionPool(config.postgres.connectionString);
  }

  return db;
};

export type ExecuteOnMongoDBOptions =
  | {
      collectionName: string;
      databaseName?: string;
    }
  | string;

export const enum PostgresErrors {
  FAILED_TO_UPDATE_ROW = 'FAILED_TO_UPDATE_ROW',
  ROW_NOT_FOUND = 'ROW_NOT_FOUND',
}

export const assertUpdated = async <T>(
  update: () => Promise<T[]>
): Promise<T[]> => {
  const result = await update();

  if (result.length === 0) {
    throw PostgresErrors.FAILED_TO_UPDATE_ROW;
  }

  return result;
};

export const assertFound = async <T>(
  find: () => Promise<T | null>
): Promise<T> => {
  const result = await find();

  if (result === null) {
    throw PostgresErrors.ROW_NOT_FOUND;
  }

  return result;
};

//////////////////////////////////////
/// Retries
//////////////////////////////////////

export const retryIfNotFound = <T>(
  find: () => Promise<T | null>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> => {
  return retryPromise(() => assertFound(find), options);
};

export const retryIfNotUpdated = <T>(
  update: () => Promise<T[]>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T[]> => {
  return retryPromise(() => assertUpdated(update), options);
};
