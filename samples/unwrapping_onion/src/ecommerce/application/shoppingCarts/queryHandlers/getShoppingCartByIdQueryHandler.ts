import { QueryHandler } from '#core/queries';
import GetShoppingCartById from 'src/ecommerce/application/shoppingCarts/queries/getShoppingCartById';
import ShoppingCartRepository from 'src/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ShoppingCartModel } from 'src/ecommerce/models/shoppingCarts/shoppingCart';

export default class GetShoppingCartByIdHandler
  implements QueryHandler<GetShoppingCartById, ShoppingCartModel | null>
{
  constructor(private repository: ShoppingCartRepository) {}

  handle(query: GetShoppingCartById): Promise<ShoppingCartModel | null> {
    return this.repository.find(query.shoppingCartId);
  }
}
