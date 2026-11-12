import type { QueryHandler } from '#core/queries';
import type { GetShoppingCartById } from '../../shoppingCarts/queries/getShoppingCartById';
import type { ShoppingCartRepository } from '../../../infrastructure/shoppingCarts/shoppingCartRepository';
import type { ShoppingCartModel } from '../../../models/shoppingCarts/shoppingCart';

export class GetShoppingCartByIdHandler implements QueryHandler<
  GetShoppingCartById,
  ShoppingCartModel | null
> {
  constructor(private repository: ShoppingCartRepository) {}

  handle(query: GetShoppingCartById): Promise<ShoppingCartModel | null> {
    return this.repository.find(query.shoppingCartId);
  }
}
