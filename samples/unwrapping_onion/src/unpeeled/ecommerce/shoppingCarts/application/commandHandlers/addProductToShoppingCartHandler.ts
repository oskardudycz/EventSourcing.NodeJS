import { CommandHandler } from '#core/commands';
import { EventBus } from '#core/events';
import { ShoppingCartRepository } from 'src/unpeeled/ecommerce/shoppingCarts/infrastructure/shoppingCartRepository';
import { AddProductItemToShoppingCart } from '../commands/shoppingCarts/addProductItemToShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class AddProductItemToShoppingCartHandler
  implements CommandHandler<AddProductItemToShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus
  ) {}

  async handle(command: AddProductItemToShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    const event = aggregate.addProductItem(command.productItem);

    await this.repository.store(model, event);

    await this.eventBus.publish(event);
  }
}
