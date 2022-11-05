import { MongoClient } from 'mongodb';
import { registerCommandHandler } from '#core/commands';
import { registerQueryHandler } from '#core/queries';
import { OpenShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/openShoppingCart';
import { GetShoppingCartById } from 'src/ecommerce/application/shoppingCarts/queries/getShoppingCartById';
import { AddProductItemToShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/addProductItemToShoppingCart';
import { RemoveProductItemFromShoppingCart } from './commands/shoppingCarts/removeProductItemFromShoppingCart';
import { ShoppingCartMapper } from './mapper';
import { OpenShoppingCartHandler } from './commandHandlers/openShoppingCartHandler';
import { AddProductItemToShoppingCartHandler } from './commandHandlers/addProductToShoppingCartHandler';
import { RemoveProductItemFromShoppingCartHandler } from './commandHandlers/removeProductFromShoppingCartHandler';
import { GetShoppingCartByIdHandler } from './queryHandlers/getShoppingCartByIdQueryHandler';
import { ShoppingCartRepository } from 'src/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ConfirmShoppingCart } from './commands/shoppingCarts/confirmShoppingCart';
import { ConfirmShoppingCartHandler } from './commandHandlers/confirmShoppingCart';

const registerHandlers = (mongo: MongoClient) => {
  const repository = new ShoppingCartRepository(mongo);
  const mapper = new ShoppingCartMapper();

  registerCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(repository, mapper)
  );
  registerCommandHandler(
    AddProductItemToShoppingCart,
    new AddProductItemToShoppingCartHandler(repository, mapper)
  );
  registerCommandHandler(
    RemoveProductItemFromShoppingCart,
    new RemoveProductItemFromShoppingCartHandler(repository, mapper)
  );
  registerCommandHandler(
    ConfirmShoppingCart,
    new ConfirmShoppingCartHandler(repository, mapper)
  );
  registerQueryHandler(
    GetShoppingCartById,
    new GetShoppingCartByIdHandler(repository)
  );
};

export default registerHandlers;
