import { MongoDbRepository } from '#core/repositories';
import { MongoClient } from 'mongodb';
import { ShoppingCartModel } from '../../models/shoppingCarts/shoppingCart';

export default class ShoppingCartRepository extends MongoDbRepository<ShoppingCartModel> {
  constructor(mongo: MongoClient) {
    super(mongo, 'shoppingCarts');
  }
}
