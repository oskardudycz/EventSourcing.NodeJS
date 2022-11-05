import { CommandHandler } from '#core/commands';
import { ShoppingCartRepository } from 'src/onion/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ConfirmShoppingCart } from '../commands/shoppingCarts/confirmShoppingCart';
import { ShoppingCartMapper } from '../mappers/shoppingCartMapper';

export class ConfirmShoppingCartHandler
  implements CommandHandler<ConfirmShoppingCart>
{
  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper
  ) {}

  async handle(command: ConfirmShoppingCart): Promise<void> {
    const model = await this.repository.find(command.shoppingCartId);

    if (model === null) {
      throw Error(`Shopping cart with id ${command.shoppingCartId} not found!`);
    }

    const aggregate = this.mapper.toAggregate(model);
    aggregate.confirm();

    await this.repository.add(this.mapper.toModel(aggregate));
  }
}
