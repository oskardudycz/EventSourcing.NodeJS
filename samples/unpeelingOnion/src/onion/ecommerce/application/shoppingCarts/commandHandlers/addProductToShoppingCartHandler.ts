import { CommandHandler } from '#core/commands';
import { EventBus } from '#core/events';
import { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import { AddProductItemToShoppingCart } from '../commands/shoppingCarts/addProductItemToShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class AddProductItemToShoppingCartHandler
  implements CommandHandler<AddProductItemToShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus,
  ) {}

  async handle(command: AddProductItemToShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    aggregate.addProductItem(command.productItem);

    await this.repository.add(this.mapper.toModel(aggregate));

    for (const event of aggregate.dequeueUncomittedEvents()) {
      await this.eventBus.publish(event);
    }
  }
}
