import { RegisterCommandHandler } from '#core/commands';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';
import OpenShoppingCartHandler from './openShoppingCartHandler';

const registerHandlers = () => {
  RegisterCommandHandler(OpenShoppingCart, new OpenShoppingCartHandler());
};

export default registerHandlers;
