import { MongoClient, Collection } from 'mongodb';
import { config } from '#config';

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

export type ExecuteOnMongoDBOptions = {
  collectionName: string;
  databaseName?: string;
};

export async function getSingleFromMongoDB<Document>(
  collectionName: string,
  callback: (collection: Collection<Document>) => Promise<Document | null>
): Promise<Document | null> {
  return executeOnMongoDB<Document, Document | null>(
    { collectionName },
    callback
  );
}

export async function executeOnMongoDB<Document, Result = void>(
  options: ExecuteOnMongoDBOptions,
  callback: (collection: Collection<Document>) => Promise<Result>
): Promise<Result> {
  let mongo: MongoClient | undefined;
  try {
    mongo = await getMongoDB();

    const { databaseName, collectionName } = options;

    const db = mongo.db(databaseName);
    const collection = db.collection<Document>(collectionName);

    return await callback(collection);
  } catch (error) {
    console.error(`Error while doing MongoDB call: ${error}`);
    throw error;
  }
}
