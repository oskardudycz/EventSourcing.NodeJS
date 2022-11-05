import { QueryHandler } from '#core/queries';
import { GetShoppingCartById } from 'src/unpeeled/ecommerce/application/shoppingCarts/queries/getShoppingCartById';
import { ShoppingCartRepository } from 'src/unpeeled/ecommerce/infrastructure/shoppingCarts/shoppingCartRepository';
import { ShoppingCartModel } from 'src/unpeeled/ecommerce/models/shoppingCarts/shoppingCart';

export class GetShoppingCartByIdHandler
  implements QueryHandler<GetShoppingCartById, ShoppingCartModel | null>
{
  constructor(private repository: ShoppingCartRepository) {}

  handle(query: GetShoppingCartById): Promise<ShoppingCartModel | null> {
    return this.repository.find(query.shoppingCartId);
  }
}
