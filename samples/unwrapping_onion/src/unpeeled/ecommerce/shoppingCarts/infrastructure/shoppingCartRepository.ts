import { MongoDbRepository } from '#core/repositories';
import { MongoClient } from 'mongodb';
import { ShoppingCartModel } from 'src/unpeeled/ecommerce/shoppingCarts/models/shoppingCart';

export class ShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }

  async findAllByCustomerId(customerId: string): Promise<ShoppingCartModel[]> {
    return this.collection.find({ customerId }).toArray();
  }
}
