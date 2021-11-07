import { MongoClient, Collection } from 'mongodb';
import { config } from '#config';

export function getMongoDB(connectionString?: string): MongoClient {
  if (!config.mongoDB.connectionString) {
    throw 'MongoDB connection string not set. Please define "ESDB_CONNECTION_STRING" environment variable';
  }

  return new MongoClient(config.mongoDB.connectionString);
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
    mongo = getMongoDB();
    await mongo.connect();

    const { databaseName, collectionName } = options;

    const db = mongo.db(databaseName);
    const collection = db.collection<Document>(collectionName);

    return await callback(collection);
  } catch (error) {
    console.error(`Error while doing MongoDB call: ${error}`);
    throw error;
  } finally {
    if (mongo) {
      await mongo.close();
    }
  }
}
