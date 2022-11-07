import { Event } from '#core/events';
import { ProductItem } from 'src/onion/ecommerce/common/shoppingCarts/productItem';

export class ProductItemRemovedFromShoppingCart extends Event {
  constructor(
    public readonly shoppingCartId: string,
    public readonly productItem: ProductItem,
    public readonly removedAt: Date
  ) {
    super();
  }
}
