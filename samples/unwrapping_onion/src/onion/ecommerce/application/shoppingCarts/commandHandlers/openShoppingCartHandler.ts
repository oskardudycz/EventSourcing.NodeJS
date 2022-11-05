import { CommandHandler } from '#core/commands';
import { OpenShoppingCart } from '../commands/shoppingCarts/openShoppingCart';
import { ShoppingCart } from 'src/onion/ecommerce/domain/shoppingCarts';
import { ShoppingCartRepository } from 'src/onion/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper
  ) {}

  handle(command: OpenShoppingCart): Promise<void> {
    const aggregate = ShoppingCart.open(
      command.shoppingCartId,
      command.customerId
    );

    return this.repository.add(this.mapper.toModel(aggregate));
  }
}
