import type { CommandHandler } from '#core/commands';
import type { EventBus } from '#core/events';
import type { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import type { ConfirmShoppingCart } from '../commands/shoppingCarts/confirmShoppingCart';
import type { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class ConfirmShoppingCartHandler implements CommandHandler<ConfirmShoppingCart> {
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus,
  ) {}

  async handle(command: ConfirmShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    aggregate.confirm();

    await this.repository.add(this.mapper.toModel(aggregate));

    for (const event of aggregate.dequeueUncomittedEvents()) {
      await this.eventBus.publish(event);
    }
  }
}
