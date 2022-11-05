import { Command } from '#core/commands';
import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/common/productItem';

export class AddProductItemToShoppingCart extends Command {
  constructor(
    public readonly shoppingCartId: string,
    public readonly productItem: ProductItem
  ) {
    super();
  }
}
