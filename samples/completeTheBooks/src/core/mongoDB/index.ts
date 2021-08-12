import { MongoClient, Collection } from 'mongodb';
import { config } from '#config';

export function getMongoDB(): MongoClient {
  if (!config.mongoDB.connectionString) {
    throw 'MongoDB connection string not set. Please define "ESDB_CONNECTION_STRING" environment variable';
  }

  return new MongoClient(config.mongoDB.connectionString);
}

export type ExecuteOnMongoDBOptions = {
  collectionName: string;
  databaseName?: string;
};

export function executeOnMongoDB<Document, Result = void>(
  options: ExecuteOnMongoDBOptions,
  callback: (collection: Collection<Document>) => Promise<Result>
) {
  let mongo: MongoClient | undefined;
  try {
    mongo = getMongoDB();

    const { databaseName, collectionName } = options;
    const db = mongo.db(databaseName);
    const collection = db.collection<Document>(collectionName);

    return callback(collection);
  } catch (error) {
    console.error(`Error while doing MongoDB call: ${error}`);
    throw error;
  } finally {
    if (mongo) {
      mongo.close();
    }
  }
}
