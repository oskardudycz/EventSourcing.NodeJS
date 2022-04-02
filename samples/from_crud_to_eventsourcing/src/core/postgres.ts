//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

import createConnectionPool, { ConnectionPool } from '@databases/pg';
import { config } from '#config';
// import { DEFAULT_RETRY_OPTIONS, RetryOptions, retryPromise } from './retries';

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

// export const getMongoCollection = async <Document>(
//   options: ExecuteOnMongoDBOptions
// ): Promise<Collection<Document>> => {
//   const mongo = await getMongoDB();

//   const { databaseName, collectionName } =
//     typeof options !== 'string'
//       ? options
//       : { databaseName: undefined, collectionName: options };

//   const db = mongo.db(databaseName);
//   return db.collection<Document>(collectionName);
// };

// export const toObjectId = (id: string) => id as unknown as ObjectId;

// export const enum MongoDBErrors {
//   FAILED_TO_UPDATE_DOCUMENT = 'FAILED_TO_UPDATE_DOCUMENT',
//   DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
// }

// export const assertUpdated = async (
//   update: () => Promise<UpdateResult>
// ): Promise<UpdateResult> => {
//   const result = await update();

//   if (result.modifiedCount === 0) {
//     throw MongoDBErrors.FAILED_TO_UPDATE_DOCUMENT;
//   }

//   return result;
// };

// export const assertFound = async <T>(
//   find: () => Promise<T | null>
// ): Promise<T> => {
//   const result = await find();

//   if (result === null) {
//     throw MongoDBErrors.DOCUMENT_NOT_FOUND;
//   }

//   return result;
// };

// //////////////////////////////////////
// /// Retries
// //////////////////////////////////////

// export const retryIfNotFound = <T>(
//   find: () => Promise<T | null>,
//   options: RetryOptions = DEFAULT_RETRY_OPTIONS
// ): Promise<T> => {
//   return retryPromise(() => assertFound(find), options);
// };

// export const retryIfNotUpdated = (
//   update: () => Promise<UpdateResult>,
//   options: RetryOptions = DEFAULT_RETRY_OPTIONS
// ): Promise<UpdateResult> => {
//   return retryPromise(() => assertUpdated(update), options);
// };
