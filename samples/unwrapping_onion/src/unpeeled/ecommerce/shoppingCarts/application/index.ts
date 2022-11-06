import { MongoClient } from 'mongodb';
import { registerCommandHandler } from '#core/commands';
import { registerQueryHandler } from '#core/queries';
import { OpenShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/openShoppingCart';
import { GetShoppingCartById } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getShoppingCartById';
import { AddProductItemToShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/addProductItemToShoppingCart';
import { RemoveProductItemFromShoppingCart } from './commands/shoppingCarts/removeProductItemFromShoppingCart';
import { ShoppingCartMapper } from './mappers/shoppingCartMapper';
import { GetShoppingCartByIdHandler } from './queryHandlers/getShoppingCartByIdQueryHandler';
import { ShoppingCartRepository } from 'src/unpeeled/ecommerce/shoppingCarts/infrastructure/shoppingCartRepository';
import { ConfirmShoppingCart } from './commands/shoppingCarts/confirmShoppingCart';
import { GetCustomerShoppingHistory } from './queries/getCustomerShoppingHistory';
import { GetCustomerShoppingHistoryHandler } from './queryHandlers/getCustomerShoppingHistoryHandler';
import { CustomerShoppingHistoryMapper } from './mappers/customerShoppingHistoryMapper';
import { EventBusFactory } from '#core/events';

const registerHandlers = (mongo: MongoClient) => {
  const repository = new ShoppingCartRepository(mongo);
  const shoppingHistoryMapper = new CustomerShoppingHistoryMapper();

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
