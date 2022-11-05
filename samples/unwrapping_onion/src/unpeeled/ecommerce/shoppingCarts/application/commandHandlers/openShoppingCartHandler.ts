import { CommandHandler } from '#core/commands';
import { OpenShoppingCart } from '../commands/shoppingCarts/openShoppingCart';
import { ShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts';
import { ShoppingCartRepository } from 'src/unpeeled/ecommerce/shoppingCarts/infrastructure/shoppingCartRepository';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';
import { EventBus } from '#core/events';

export class OpenShoppingCartHandler
  implements CommandHandler<OpenShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus
  ) {}

  async handle(command: OpenShoppingCart): Promise<void> {
    const { aggregate, event } = ShoppingCart.open(
      command.shoppingCartId,
      command.customerId
    );

    await this.repository.add(this.mapper.toModel(aggregate));

    await this.eventBus.publish(event);
  }
}
