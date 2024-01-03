import { QueryHandler } from '#core/queries';
import { GetShoppingCartById } from '../../shoppingCarts/queries/getShoppingCartById';
import { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import { ShoppingCartModel } from '../../../models/shoppingCarts/shoppingCart';

export class GetShoppingCartByIdHandler
  implements QueryHandler<GetShoppingCartById, ShoppingCartModel | null>
{
  constructor(private repository: ShoppingCartRepository) {}

  handle(query: GetShoppingCartById): Promise<ShoppingCartModel | null> {
    return this.repository.find(query.shoppingCartId);
  }
}
