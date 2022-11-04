import { MongoDbRepository } from '#core/repositories';
import { MongoClient } from 'mongodb';
import { ShoppingCartModel } from '../../models/shoppingCart';

export default class ShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }
}
