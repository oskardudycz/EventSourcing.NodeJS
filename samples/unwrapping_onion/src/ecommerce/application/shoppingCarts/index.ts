import { MongoClient } from 'mongodb';
import { RegisterCommandHandler } from '#core/commands';
import { RegisterQueryHandler } from '#core/queries';
import ShoppingCartRepository from '../../infrastructure/shoppingCarts/shoppingCartRepository';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';
import OpenShoppingCartHandler from './commandHandlers/openShoppingCartHandler';
import GetShoppingCartById from '../../domain/queries/getShoppingCartById';
import GetShoppingCartByIdHandler from './queryHandlers/getShoppingCartByIdQueryHandler';

const registerHandlers = (mongo: MongoClient) => {
  const repository = new ShoppingCartRepository(mongo);
  RegisterCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(repository)
  );
  RegisterQueryHandler(
    GetShoppingCartById,
    new GetShoppingCartByIdHandler(repository)
  );
};

export default registerHandlers;
