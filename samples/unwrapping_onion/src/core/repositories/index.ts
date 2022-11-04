import { Collection, Document, Filter, MongoClient, ObjectId } from 'mongodb';

export interface Repository<T> {
  add(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  find(id: string): Promise<T | null>;
}

export class MongoDbRepository<T extends Document & { _id: ObjectId }>
  implements Repository<T>
{
  private collection: Collection<T>;

  constructor(
    mongo: MongoClient,
    collectionName: string,
    databaseName?: string | undefined
  ) {
    const db = mongo.db(databaseName);
    this.collection = db.collection<T>(collectionName);
  }
  async add(entity: T): Promise<void> {
    await this.collection.updateOne(entity, {}, { upsert: true });
  }
  async update(entity: T): Promise<void> {
    await this.collection.updateOne(entity, {}, { upsert: false });
  }

  async find(id: string): Promise<T | null> {
    const result = await this.collection.findOne(new ObjectId(id) as Filter<T>);

    if (result === null) return null;

    return result as T;
  }
}
