import { CommandHandler } from '#core/commands';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';

export default class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  handle(_command: OpenShoppingCart): Promise<void> {
    return Promise.resolve();
  }
}
