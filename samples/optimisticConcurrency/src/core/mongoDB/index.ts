import { MongoClient, Collection, UpdateResult } from 'mongodb';
import { config } from '#config';
import {
  DEFAULT_RETRY_OPTIONS,
  RetryOptions,
  retryPromise,
} from '#core/http/requests';

let mongoClient: MongoClient;
let isOpened = false;

export async function getMongoDB(
  connectionString?: string
): Promise<MongoClient> {
  if (connectionString ?? !config.mongoDB.connectionString) {
    throw 'MongoDB connection string not set. Please define "ESDB_CONNECTION_STRING" environment variable';
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(
      connectionString ?? config.mongoDB.connectionString
    );
    await mongoClient.connect();
    isOpened = true;
  }

  return mongoClient;
}

export async function disconnectFromMongoDB(): Promise<void> {
  if (!isOpened) return;

  isOpened = false;
  return mongoClient.close();
}

export type ExecuteOnMongoDBOptions =
  | {
      collectionName: string;
      databaseName?: string;
    }
  | string;

export async function getMongoCollection<Document>(
  options: ExecuteOnMongoDBOptions
): Promise<Collection<Document>> {
  const mongo = await getMongoDB();

  const { databaseName, collectionName } =
    typeof options !== 'string'
      ? options
      : { databaseName: undefined, collectionName: options };

  const db = mongo.db(databaseName);
  return db.collection<Document>(collectionName);
}

export type FAILED_TO_UPDATE_DOCUMENT = 'FAILED_TO_UPDATE_DOCUMENT';

export async function assertUpdated(
  update: () => Promise<UpdateResult>
): Promise<UpdateResult> {
  const result = await update();

  if (result.modifiedCount === 0) {
    throw 'FAILED_TO_UPDATE_DOCUMENT';
  }

  return result;
}

export function retryIfNotUpdated(
  update: () => Promise<UpdateResult>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<UpdateResult> {
  return retryPromise(() => assertUpdated(update), options);
}

export type DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND';

export async function assertFound<T>(
  find: () => Promise<T | null>
): Promise<T> {
  const result = await find();

  if (result === null) {
    throw 'DOCUMENT_NOT_FOUND';
  }

  return result;
}

export function retryIfNotFound<T>(
  find: () => Promise<T | null>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  return retryPromise(() => assertFound(find), options);
}
