import { MongoClient, Collection, Document } from 'mongodb';
import { config } from '#config';

export function getMongoDB(connectionString?: string): MongoClient {
  if (!connectionString && !config.mongoDB.connectionString) {
    throw 'MongoDB connection string not set. Please define "MONGODB_CONNECTION_STRING" environment variable';
  }

  console.log(config.mongoDB.connectionString);

  return new MongoClient(connectionString ?? config.mongoDB.connectionString, {
    directConnection: true,
  });
}

export type ExecuteOnMongoDBOptions = {
  collectionName: string;
  databaseName?: string;
};

export async function executeOnMongoDB<Doc extends Document, Result = void>(
  options: ExecuteOnMongoDBOptions,
  callback: (collection: Collection<Doc>) => Promise<Result>,
) {
  let mongo: MongoClient | undefined;
  try {
    mongo = getMongoDB();
    await mongo.connect();

    const { databaseName, collectionName } = options;

    const db = mongo.db(databaseName);
    const collection = db.collection<Doc>(collectionName);

    return await callback(collection);
  } catch (error) {
    console.error(`Error while doing MongoDB call`);
    console.error(error);
    throw error;
  } finally {
    if (mongo) {
      await mongo.close();
    }
  }
}
