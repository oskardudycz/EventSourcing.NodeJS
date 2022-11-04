import { CommandHandler } from '#core/commands';
import OpenShoppingCart from '../../domain/commands/shoppingCarts/openShoppingCart';
import { ObjectId } from 'mongodb';
import { ShoppingCartModel } from '../../models/shoppingCarts/shoppingCart';
import { Repository } from '#core/repositories';
import { ShoppingCartStatus } from '../../models/shoppingCarts/shoppingCartStatus';

export default class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  constructor(private repository: Repository<ShoppingCartModel>) {}

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
