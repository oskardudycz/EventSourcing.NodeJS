import { CommandHandler } from '#core/commands';
import OpenShoppingCart from '../../../domain/commands/shoppingCarts/openShoppingCart';
import ShoppingCartRepository from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import ShoppingCartMapper from '../mapper';
import ShoppingCart from '../../../domain/aggregates/shoppingCarts';

export default class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper
  ) {}

  handle(command: OpenShoppingCart): Promise<void> {
    const aggregate = ShoppingCart.open(
      command.shoppingCartId,
      command.clientId
    );

    return this.repository.add(this.mapper.toModel(aggregate));
  }
}
