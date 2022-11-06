import { CommandHandler } from '#core/commands';
import { EventBus } from '#core/events';
import { ShoppingCartRepository } from 'src/unpeeled/ecommerce/shoppingCarts/infrastructure/shoppingCartRepository';
import { ConfirmShoppingCart } from '../commands/shoppingCarts/confirmShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class ConfirmShoppingCartHandler
  implements CommandHandler<ConfirmShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus
  ) {}

  async handle(command: ConfirmShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    const event = aggregate.confirm();

    await this.repository.store(model, event);

    await this.eventBus.publish(event);
  }
}
