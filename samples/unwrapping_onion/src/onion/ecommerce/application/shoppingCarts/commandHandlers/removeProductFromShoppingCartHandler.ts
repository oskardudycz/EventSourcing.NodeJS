import { CommandHandler } from '#core/commands';
import { ShoppingCartRepository } from 'src/onion/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { RemoveProductItemFromShoppingCart } from '../commands/shoppingCarts/removeProductItemFromShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class RemoveProductItemFromShoppingCartHandler
  implements CommandHandler<RemoveProductItemFromShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper
  ) {}

  async handle(command: RemoveProductItemFromShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    aggregate.removeProductItem(command.productItem);

    await this.repository.add(this.mapper.toModel(aggregate));
  }
}
