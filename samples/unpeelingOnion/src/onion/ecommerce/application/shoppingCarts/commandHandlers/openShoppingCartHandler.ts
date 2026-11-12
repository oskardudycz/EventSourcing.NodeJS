import type { CommandHandler } from '#core/commands';
import type { OpenShoppingCart } from '../commands/shoppingCarts/openShoppingCart';
import { ShoppingCart } from '../../../domain/shoppingCarts';
import type { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import type { ShoppingCartMapper } from '../mappers/shoppingCartMapper';
import type { EventBus } from '#core/events';

export class OpenShoppingCartHandler implements CommandHandler<OpenShoppingCart> {
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus,
  ) {}

  async handle(command: OpenShoppingCart): Promise<void> {
    const aggregate = ShoppingCart.open(
      command.shoppingCartId,
      command.customerId,
    );

    await this.repository.add(this.mapper.toModel(aggregate));

    for (const event of aggregate.dequeueUncomittedEvents()) {
      await this.eventBus.publish(event);
    }
  }
}
