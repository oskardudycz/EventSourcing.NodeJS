import { MongoClient } from 'mongodb';
import { registerCommandHandler } from '#core/commands';
import { registerQueryHandler } from '#core/queries';
import { OpenShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/openShoppingCart';
import { GetShoppingCartById } from 'src/ecommerce/application/shoppingCarts/queries/getShoppingCartById';
import { AddProductItemToShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/addProductItemToShoppingCart';
import { RemoveProductItemFromShoppingCart } from './commands/shoppingCarts/removeProductItemFromShoppingCart';
import { ShoppingCartMapper } from './mappers/shoppingCartMapper';
import { OpenShoppingCartHandler } from './commandHandlers/openShoppingCartHandler';
import { AddProductItemToShoppingCartHandler } from './commandHandlers/addProductToShoppingCartHandler';
import { RemoveProductItemFromShoppingCartHandler } from './commandHandlers/removeProductFromShoppingCartHandler';
import { GetShoppingCartByIdHandler } from './queryHandlers/getShoppingCartByIdQueryHandler';
import { MongoDBShoppingCartRepository } from 'src/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ConfirmShoppingCart } from './commands/shoppingCarts/confirmShoppingCart';
import { ConfirmShoppingCartHandler } from './commandHandlers/confirmShoppingCart';
import { GetCustomerShoppingHistory } from './queries/getCustomerShoppingHistory';
import { GetCustomerShoppingHistoryHandler } from './queryHandlers/getCustomerShoppingHistoryHandler';
import { CustomerShoppingHistoryMapper } from './mappers/customerShoppingHistoryMapper';

const registerHandlers = (mongo: MongoClient) => {
  const repository = new MongoDBShoppingCartRepository(mongo);
  const shoppingCartMapper = new ShoppingCartMapper();
  const shoppingHistoryMapper = new CustomerShoppingHistoryMapper();

  registerCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(repository, shoppingCartMapper)
  );
  registerCommandHandler(
    AddProductItemToShoppingCart,
    new AddProductItemToShoppingCartHandler(repository, shoppingCartMapper)
  );
  registerCommandHandler(
    RemoveProductItemFromShoppingCart,
    new RemoveProductItemFromShoppingCartHandler(repository, shoppingCartMapper)
  );
  registerCommandHandler(
    ConfirmShoppingCart,
    new ConfirmShoppingCartHandler(repository, shoppingCartMapper)
  );
  registerQueryHandler(
    GetShoppingCartById,
    new GetShoppingCartByIdHandler(repository)
  );
  registerQueryHandler(
    GetCustomerShoppingHistory,
    new GetCustomerShoppingHistoryHandler(repository, shoppingHistoryMapper)
  );
};

export default registerHandlers;
