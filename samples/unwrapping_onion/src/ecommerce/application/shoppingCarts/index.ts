import { RegisterCommandHandler } from '#core/commands';
import ShoppingCartRepository from '../../infrastructure/shoppingCarts/shoppingCartRepository';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';
import OpenShoppingCartHandler from './openShoppingCartHandler';
import { MongoClient } from 'mongodb';

const registerHandlers = (mongo: MongoClient) => {
  RegisterCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(new ShoppingCartRepository(mongo))
  );
};

export default registerHandlers;
