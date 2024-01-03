import { CommandHandler } from '#core/commands';
import { EventBus } from '#core/events';
import { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import { ConfirmShoppingCart } from '../commands/shoppingCarts/confirmShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class ConfirmShoppingCartHandler
  implements CommandHandler<ConfirmShoppingCart>
{
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
