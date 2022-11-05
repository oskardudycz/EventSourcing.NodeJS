import { MongoClient } from 'mongodb';
import { RegisterCommandHandler } from '#core/commands';
import { RegisterQueryHandler } from '#core/queries';
import ShoppingCartRepository from 'src/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import OpenShoppingCart from 'src/ecommerce/domain/commands/shoppingCarts/openShoppingCart';
import GetShoppingCartById from 'src/ecommerce/domain/queries/getShoppingCartById';
import AddProductItemToShoppingCart from 'src/ecommerce/domain/commands/shoppingCarts/addProductItemToShoppingCart';
import OpenShoppingCartHandler from './commandHandlers/openShoppingCartHandler';
import GetShoppingCartByIdHandler from './queryHandlers/getShoppingCartByIdQueryHandler';
import AddProductItemToShoppingCartHandler from './commandHandlers/addProductToShoppingCartHandler';
import ShoppingCartMapper from './mapper';

const registerHandlers = (mongo: MongoClient) => {
  const repository = new ShoppingCartRepository(mongo);
  const mapper = new ShoppingCartMapper();

  RegisterCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(repository, mapper)
  );
  RegisterCommandHandler(
    AddProductItemToShoppingCart,
    new AddProductItemToShoppingCartHandler(repository, mapper)
  );
  RegisterQueryHandler(
    GetShoppingCartById,
    new GetShoppingCartByIdHandler(repository)
  );
};

export default registerHandlers;
