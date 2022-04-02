//////////////////////////////////////
/// MongoDB
//////////////////////////////////////

import { MongoClient, Collection, ObjectId, UpdateResult } from 'mongodb';
import { DEFAULT_RETRY_OPTIONS, RetryOptions, retryPromise } from './retries';
import { getEventStore } from './streams';
import {
  Checkpoint,
  EventHandler,
  SubscriptionResolvedEvent,
  SubscriptionToAll,
} from './subscriptions';

let mongoClient: MongoClient;

export const getMongoDB = async (
  connectionString?: string
): Promise<MongoClient> => {
  if (!mongoClient) {
    mongoClient = new MongoClient(
      connectionString ?? 'mongodb://localhost:27017/'
    );
    await mongoClient.connect();
  }

  return mongoClient;
};

export type ExecuteOnMongoDBOptions =
  | {
      collectionName: string;
      databaseName?: string;
    }
  | string;

export const getMongoCollection = async <Document>(
  options: ExecuteOnMongoDBOptions
): Promise<Collection<Document>> => {
  const mongo = await getMongoDB();

  const { databaseName, collectionName } =
    typeof options !== 'string'
      ? options
      : { databaseName: undefined, collectionName: options };

  const db = mongo.db(databaseName);
  return db.collection<Document>(collectionName);
};

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
  (handle: EventHandler) => async (event: SubscriptionResolvedEvent) => {
    await handle(event);
    const checkpoints = await getCheckpointsCollection();

    await checkpoints.updateOne(
      {
        _id: toObjectId(event.subscriptionId),
      },
      {
        $set: {
          position: event.commitPosition!.toString(),
        },
      },
      {
        upsert: true,
      }
    );
  };

export const SubscriptionToAllWithMongoCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromCollection
);
