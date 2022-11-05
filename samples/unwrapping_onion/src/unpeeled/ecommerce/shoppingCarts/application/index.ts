import { MongoClient } from 'mongodb';
import { registerCommandHandler } from '#core/commands';
import { registerQueryHandler } from '#core/queries';
import { OpenShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/openShoppingCart';
import { GetShoppingCartById } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getShoppingCartById';
import { AddProductItemToShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/addProductItemToShoppingCart';
import { RemoveProductItemFromShoppingCart } from './commands/shoppingCarts/removeProductItemFromShoppingCart';
import { ShoppingCartMapper } from './mappers/shoppingCartMapper';
import { OpenShoppingCartHandler } from './commandHandlers/openShoppingCartHandler';
import { AddProductItemToShoppingCartHandler } from './commandHandlers/addProductToShoppingCartHandler';
import { RemoveProductItemFromShoppingCartHandler } from './commandHandlers/removeProductFromShoppingCartHandler';
import { GetShoppingCartByIdHandler } from './queryHandlers/getShoppingCartByIdQueryHandler';
import { MongoDBShoppingCartRepository } from 'src/unpeeled/ecommerce/shoppingCarts/infrastructure/shoppingCartRepository';
import { ConfirmShoppingCart } from './commands/shoppingCarts/confirmShoppingCart';
import { ConfirmShoppingCartHandler } from './commandHandlers/confirmShoppingCart';
import { GetCustomerShoppingHistory } from './queries/getCustomerShoppingHistory';
import { GetCustomerShoppingHistoryHandler } from './queryHandlers/getCustomerShoppingHistoryHandler';
import { CustomerShoppingHistoryMapper } from './mappers/customerShoppingHistoryMapper';
import { EventBusFactory } from '#core/events';

const registerHandlers = (mongo: MongoClient) => {
  const repository = new MongoDBShoppingCartRepository(mongo);
  const eventBus = EventBusFactory();

  const shoppingCartMapper = new ShoppingCartMapper();
  const shoppingHistoryMapper = new CustomerShoppingHistoryMapper();

  registerCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(repository, shoppingCartMapper, eventBus)
  );
  registerCommandHandler(
    AddProductItemToShoppingCart,
    new AddProductItemToShoppingCartHandler(
      repository,
      shoppingCartMapper,
      eventBus
    )
  );
  registerCommandHandler(
    RemoveProductItemFromShoppingCart,
    new RemoveProductItemFromShoppingCartHandler(
      repository,
      shoppingCartMapper,
      eventBus
    )
  );
  registerCommandHandler(
    ConfirmShoppingCart,
    new ConfirmShoppingCartHandler(repository, shoppingCartMapper, eventBus)
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
