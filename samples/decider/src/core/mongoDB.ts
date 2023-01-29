//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

import { config } from '#config';
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
  connectionString?: string
): Promise<MongoClient> => {
  if (!connectionString && !config.mongoDB.connectionString) {
    throw 'MongoDB connection string not set. Please define "MONGODB_CONNECTION_STRING" environment variable';
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(
      connectionString ?? config.mongoDB.connectionString
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

export async function getMongoCollection<Doc extends Document>(
  options: ExecuteOnMongoDBOptions
): Promise<Collection<Doc>> {
  const mongo = await getMongoDB();

  const { databaseName, collectionName } =
    typeof options !== 'string'
      ? options
      : { databaseName: config.mongoDB.databaseName, collectionName: options };

  const db = mongo.db(databaseName);
  return db.collection<Doc>(collectionName);
}

export const toObjectId = (id: string) => id as unknown as ObjectId;

export const enum MongoDBErrors {
  FAILED_TO_UPDATE_DOCUMENT = 'FAILED_TO_UPDATE_DOCUMENT',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
}

export const assertUpdated = async (
  update: () => Promise<UpdateResult>
): Promise<UpdateResult> => {
  const result = await update();

  if (result.modifiedCount === 0) {
    throw MongoDBErrors.FAILED_TO_UPDATE_DOCUMENT;
  }

  return result;
};

export const assertFound = async <T>(
  find: () => Promise<T | null>
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
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> => {
  return retryPromise(() => assertFound(find), options);
};

export const retryIfNotUpdated = (
  update: () => Promise<UpdateResult>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<UpdateResult> => {
  return retryPromise(() => assertUpdated(update), options);
};

//////////////////////////////////////
/// MongoDB Checkpointing
//////////////////////////////////////

export const getCheckpointsCollection = () =>
  getMongoCollection<Checkpoint>('checkpoints');

export const loadCheckPointFromCollection = async (subscriptionId: string) => {
  const checkpoints = await getCheckpointsCollection();

  const checkpoint = await checkpoints.findOne({
    _id: toObjectId(subscriptionId),
  });

  return checkpoint != null ? BigInt(checkpoint.position) : undefined;
};

export const storeCheckpointInCollection =
  (...handlers: EventHandler[]) =>
  async (event: SubscriptionResolvedEvent) => {
    if (!event.commitPosition) return;

    await Promise.all(handlers.map((handle) => handle(event)));

    const checkpoints = await getCheckpointsCollection();

    await checkpoints.updateOne(
      {
        _id: toObjectId(event.subscriptionId),
      },
      {
        $set: {
          position: event.commitPosition.toString(),
        },
      },
      {
        upsert: true,
      }
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

export const SubscriptionToAllWithMongoCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromCollection
);
