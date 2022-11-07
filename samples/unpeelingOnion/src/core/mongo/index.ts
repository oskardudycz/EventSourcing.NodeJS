import { Collection, Document, Filter, MongoClient, ObjectId } from 'mongodb';

export const getCollection = <T extends Document & { _id: ObjectId }>(
  mongo: MongoClient,
  collectionName: string,
  databaseName?: string | undefined
) => {
  const db = mongo.db(databaseName);
  return db.collection<T>(collectionName);
};

export const findById = async <T extends Document & { _id: ObjectId }>(
  collection: Collection<T>,
  id: string
): Promise<T | null> => {
  const result = await collection.findOne({
    _id: new ObjectId(id),
  } as Filter<T>);

  if (result === null) return null;

  return result as T;
};

export const getById = async <T extends Document & { _id: ObjectId }>(
  collection: Collection<T>,
  id: string
): Promise<T> => {
  const result = await findById(collection, id);

  if (result === null) throw Error(`Entity with id: ${id} not found`);

  return result;
};
