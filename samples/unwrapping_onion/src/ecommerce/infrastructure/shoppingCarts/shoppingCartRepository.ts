import { MongoDbRepository } from '#core/repositories';
import { MongoClient } from 'mongodb';
import { ShoppingCartModel } from 'src/ecommerce/models/shoppingCarts/shoppingCart';

export class ShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }
}
