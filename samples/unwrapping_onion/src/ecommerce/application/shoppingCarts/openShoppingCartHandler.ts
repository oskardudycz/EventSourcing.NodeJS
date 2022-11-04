import { CommandHandler } from '#core/commands';
import ShoppingCartRepository from '../../infrastructure/shoppingCarts/shoppingCartRepository';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';

export default class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  constructor(private _repository: ShoppingCartRepository) {}

  handle(_command: OpenShoppingCart): Promise<void> {
    return Promise.resolve();
  }
}
