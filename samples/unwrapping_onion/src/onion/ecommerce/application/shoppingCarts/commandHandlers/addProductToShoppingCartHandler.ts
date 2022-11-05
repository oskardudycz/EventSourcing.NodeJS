import { CommandHandler } from '#core/commands';
import { ShoppingCartRepository } from 'src/onion/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { AddProductItemToShoppingCart } from '../commands/shoppingCarts/addProductItemToShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class AddProductItemToShoppingCartHandler
  implements CommandHandler<AddProductItemToShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper
  ) {}

  async handle(command: AddProductItemToShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    aggregate.addProductItem(command.productItem);

    await this.repository.add(this.mapper.toModel(aggregate));
  }
}
