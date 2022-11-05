import { Collection, Document, Filter, MongoClient, ObjectId } from 'mongodb';

export interface Repository<T> {
  add(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  find(id: string): Promise<T | null>;
}

export abstract class MongoDbRepository<T extends Document & { _id: ObjectId }>
  implements Repository<T>
{
  protected collection: Collection<T>;

  constructor(
    mongo: MongoClient,
    collectionName: string,
    databaseName?: string | undefined
  ) {
    const db = mongo.db(databaseName);
    this.collection = db.collection<T>(collectionName);
  }

  async add(entity: T): Promise<void> {
    await this.collection.updateOne(
      { _id: entity._id } as Filter<T>,
      { $set: entity },
      { upsert: true }
    );
  }

  async update(entity: T): Promise<void> {
    await this.collection.updateOne(
      { _id: entity._id } as Filter<T>,
      { $set: entity },
      { upsert: false }
    );
  }

  async find(id: string): Promise<T | null> {
    const result = await this.collection.findOne({
      _id: new ObjectId(id),
    } as Filter<T>);

    if (result === null) return null;

    return result as T;
  }
}
