import { QueryHandler } from '#core/queries';
import { GetShoppingCartById } from 'src/onion/ecommerce/application/shoppingCarts/queries/getShoppingCartById';
import { ShoppingCartRepository } from 'src/onion/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ShoppingCartModel } from 'src/onion/ecommerce/models/shoppingCarts/shoppingCart';

export class GetShoppingCartByIdHandler
  implements QueryHandler<GetShoppingCartById, ShoppingCartModel | null>
{
  constructor(private repository: ShoppingCartRepository) {}

  handle(query: GetShoppingCartById): Promise<ShoppingCartModel | null> {
    return this.repository.find(query.shoppingCartId);
  }
}
