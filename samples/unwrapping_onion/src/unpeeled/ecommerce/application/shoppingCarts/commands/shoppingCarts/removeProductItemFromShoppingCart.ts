import { Command } from '#core/commands';
import { ProductItem } from 'src/unpeeled/ecommerce/common/shoppingCarts/productItem';

export class RemoveProductItemFromShoppingCart extends Command {
  constructor(
    public readonly shoppingCartId: string,
    public readonly productItem: ProductItem
  ) {
    super();
  }
}
