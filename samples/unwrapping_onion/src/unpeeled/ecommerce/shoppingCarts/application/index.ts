import { MongoClient } from 'mongodb';
import { registerQueryHandler } from '#core/queries';
import { GetShoppingCartById } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getShoppingCartById';
import { GetShoppingCartByIdHandler } from './queryHandlers/getShoppingCartByIdQueryHandler';
import { ShoppingCartRepository } from 'src/unpeeled/ecommerce/shoppingCarts/infrastructure/shoppingCartRepository';
import { GetCustomerShoppingHistory } from './queries/getCustomerShoppingHistory';
import { GetCustomerShoppingHistoryHandler } from './queryHandlers/getCustomerShoppingHistoryHandler';
import { CustomerShoppingHistoryMapper } from './mappers/customerShoppingHistoryMapper';

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
