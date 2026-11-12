import { Command } from '#core/commands';
import type { ProductItem } from '../../../../common/shoppingCarts/productItem';

export class RemoveProductItemFromShoppingCart extends Command {
  constructor(
    public readonly shoppingCartId: string,
    public readonly productItem: ProductItem,
  ) {
    super();
  }
}
