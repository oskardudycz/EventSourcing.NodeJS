import { CommandHandler } from '#core/commands';
import ShoppingCartRepository from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import AddProductItemToShoppingCart from '../../../domain/commands/shoppingCarts/addProductItemToShoppingCart';
import ShoppingCartMapper from '../mapper';

export default class AddProductItemToShoppingCartHandler
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
