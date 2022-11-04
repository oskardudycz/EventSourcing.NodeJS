import { Command } from '#core/commands';
import { ProductItem } from '../../../models/shoppingCarts/productItem';

export default class RemoveProductItemFromShoppingCart extends Command {
  constructor(
    public readonly shoppingCartId: string,
    public readonly productItem: ProductItem
  ) {
    super();
  }
}
