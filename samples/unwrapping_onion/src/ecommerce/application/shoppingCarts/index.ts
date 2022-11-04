import { RegisterCommandHandler } from '#core/commands';
import ShoppingCartRepository from '../../infrastructure/shoppingCarts/shoppingCartRepository';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';
import OpenShoppingCartHandler from './openShoppingCartHandler';

const registerHandlers = () => {
  RegisterCommandHandler(
    OpenShoppingCart,
    new OpenShoppingCartHandler(new ShoppingCartRepository())
  );
};

export default registerHandlers;
