import { MongoDbRepository, Repository } from '#core/mongo/repository';
import { MongoClient } from 'mongodb';
import { ShoppingCartModel } from 'src/onion/ecommerce/models/shoppingCarts/shoppingCart';

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
