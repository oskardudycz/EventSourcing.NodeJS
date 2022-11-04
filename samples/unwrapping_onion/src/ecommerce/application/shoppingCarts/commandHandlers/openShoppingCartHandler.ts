import { CommandHandler } from '#core/commands';
import OpenShoppingCart from '../../../domain/commands/shoppingCarts/openShoppingCart';
import { ObjectId } from 'mongodb';
import { ShoppingCartModel } from '../../../models/shoppingCarts/shoppingCart';
import { ShoppingCartStatus } from '../../../models/shoppingCarts/shoppingCartStatus';
import ShoppingCartRepository from '../../../infrastructure/shoppingCarts/shoppingCartRepository';

export default class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  constructor(private repository: ShoppingCartRepository) {}

  handle(command: OpenShoppingCart): Promise<void> {
    const entity = new ShoppingCartModel(
      new ObjectId(command.shoppingCartId),
      command.clientId,
      ShoppingCartStatus.Opened,
      [],
      new Date(),
      undefined,
      1
    );

    return this.repository.add(entity);
  }
}
