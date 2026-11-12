import type { Repository } from '#core/mongo/repository';
import { MongoDbRepository } from '#core/mongo/repository';
import type { MongoClient } from 'mongodb';
import type { ShoppingCartModel } from '../../models/shoppingCarts/shoppingCart';

export interface ShoppingCartRepository extends Repository<ShoppingCartModel> {
  findAllByCustomerId(customerId: string): Promise<ShoppingCartModel[]>;
}

export class MongoDBShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }

  async findAllByCustomerId(customerId: string): Promise<ShoppingCartModel[]> {
    return this.collection.find({ customerId }).toArray();
  }
}
