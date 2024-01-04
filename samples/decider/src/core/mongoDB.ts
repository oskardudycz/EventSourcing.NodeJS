//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

import { config } from '#config';
import { EventStoreDBClient } from '@eventstore/db-client';
import {
  MongoClient,
  Collection,
  ObjectId,
  UpdateResult,
  Document,
} from 'mongodb';
import { DEFAULT_RETRY_OPTIONS, RetryOptions, retryPromise } from './retries';
import { getEventStore } from './streams';
import {
  Checkpoint,
  EventHandler,
  SubscriptionResolvedEvent,
  SubscriptionToAll,
} from './subscriptions';

let mongoClient: MongoClient;
let isOpened = false;

export const getMongoDB = async (
  connectionString?: string,
): Promise<MongoClient> => {
  if (!connectionString && !config.mongoDB.connectionString) {
    throw 'MongoDB connection string not set. Please define "MONGODB_CONNECTION_STRING" environment variable';
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(
      connectionString ?? config.mongoDB.connectionString,
      {
        directConnection: true,
      },
    );
    await mongoClient.connect();
    isOpened = true;
  }

  return mongoClient;
};

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

export function getMongoCollection<Doc extends Document>(
  mongo: MongoClient,
  options: ExecuteOnMongoDBOptions,
): Collection<Doc> {
  const { databaseName, collectionName } =
    typeof options !== 'string'
      ? options
      : { databaseName: config.mongoDB.databaseName, collectionName: options };

  const db = mongo.db(databaseName);
  return db.collection<Doc>(collectionName);
}

export const toObjectId = (id: string) => id as unknown as ObjectId;

export const EmptyUpdateResult = {
  acknowledged: true,
  matchedCount: 0,
  modifiedCount: 0,
  upsertedCount: 0,
  upsertedId: new ObjectId(),
};

export const enum MongoDBErrors {
  FAILED_TO_UPDATE_DOCUMENT = 'FAILED_TO_UPDATE_DOCUMENT',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
}

export const assertUpdated = async (
  update: () => Promise<UpdateResult>,
): Promise<UpdateResult> => {
  const result = await update();

  if (result.modifiedCount === 0) {
    throw MongoDBErrors.FAILED_TO_UPDATE_DOCUMENT;
  }

  return result;
};

export const assertFound = async <T>(
  find: () => Promise<T | null>,
): Promise<T> => {
  const result = await find();

  if (result === null) {
    throw MongoDBErrors.DOCUMENT_NOT_FOUND;
  }

  return result;
};

//////////////////////////////////////
/// Retries
//////////////////////////////////////

export const retryIfNotFound = <T>(
  find: () => Promise<T | null>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<T> => {
  return retryPromise(() => assertFound(find), options);
};

export const retryIfNotUpdated = (
  update: () => Promise<UpdateResult>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<UpdateResult> => {
  return retryPromise(() => assertUpdated(update), options);
};

//////////////////////////////////////
/// MongoDB Checkpointing
//////////////////////////////////////

export const getCheckpointsCollection = (mongo: MongoClient) =>
  getMongoCollection<Checkpoint>(mongo, 'checkpoints');

export const loadCheckPointFromCollection =
  (mongo: MongoClient) => async (subscriptionId: string) => {
    const checkpoints = getCheckpointsCollection(mongo);

    const checkpoint = await checkpoints.findOne({
      _id: toObjectId(subscriptionId),
    });

    return checkpoint != null ? BigInt(checkpoint.position) : undefined;
  };

export const storeCheckpointInCollection =
  (mongo: MongoClient) => async (subscriptionId: string, position: bigint) => {
    const checkpoints = getCheckpointsCollection(mongo);

    await checkpoints.updateOne(
      {
        _id: toObjectId(subscriptionId),
      },
      {
        $set: {
          position: position.toString(),
        },
      },
      {
        upsert: true,
      },
    );
  };

export const mongoObjectId = () => {
  const timestamp = ((new Date().getTime() / 1000) | 0).toString(16);
  return (
    timestamp +
    'xxxxxxxxxxxxxxxx'
      .replace(/[x]/g, function () {
        return ((Math.random() * 16) | 0).toString(16);
      })
      .toLowerCase()
  );
};

export const SubscriptionToAllWithMongoCheckpoints = (
  eventStore: EventStoreDBClient,
  mongo: MongoClient,
) =>
  SubscriptionToAll(
    eventStore,
    loadCheckPointFromCollection(mongo),
    storeCheckpointInCollection(mongo),
  );
