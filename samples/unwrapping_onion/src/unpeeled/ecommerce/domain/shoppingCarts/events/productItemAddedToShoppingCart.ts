import { Event } from '#core/events';
import { ProductItem } from 'src/unpeeled/ecommerce/common/shoppingCarts/productItem';

export class ProductItemAddedToShoppingCart extends Event {
  constructor(
    public readonly shoppingCartId: string,
    public readonly productItem: ProductItem,
    public readonly addedAt: Date
  ) {
    super();
  }
}
