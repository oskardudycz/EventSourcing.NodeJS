//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

import { config } from '#config';
import createConnectionPool, { ConnectionPool } from '@databases/pg';
import { execSync } from 'child_process';
import { DEFAULT_RETRY_OPTIONS, RetryOptions, retryPromise } from './retries';

let db: ConnectionPool;

export const getPostgres = (): ConnectionPool => {
  if (!db) {
    if (!config.postgres.connectionString) {
      throw 'Postgres connection string not set. Please define "DATABASE_URL" environment variable';
    }

    if (!config.postgres.schemaName) {
      throw 'Postgres schema name string not set. Please define "DATABASE_SCHEMA" environment variable';
    }

    db = createConnectionPool({
      connectionString: config.postgres.connectionString,
      schema: config.postgres.schemaName,
    });
  }

  return db;
};

export const disconnectFromPostgres = async () => {
  const db = getPostgres();

  try {
    return await db.dispose();
  } catch (ex) {
    console.error(ex);
  }
};

export const runPostgresMigration = ({
  connectionString,
  migrationsPath,
}: {
  connectionString: string;
  migrationsPath: string;
}) => {
  execSync(
    `npx node_modules/@databases/pg-migrations apply --database ${connectionString} --directory ${migrationsPath}`
  );
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
