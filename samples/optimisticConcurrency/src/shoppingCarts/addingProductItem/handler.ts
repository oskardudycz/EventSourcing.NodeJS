import type { StreamEvent } from '#core/events';
import type { Command } from '#core/commands';
import type { Result } from '#core/primitives';
import { failure, success } from '#core/primitives';
import type {
  ProductItemAddedToShoppingCart,
  ShoppingCart,
  ShoppingCartEvent,
  SHOPPING_CARD_CLOSED,
} from '..';
import { ShoppingCartStatus, when } from '..';
import { aggregateStream } from '#core/streams';
import type { ProductItem } from '../productItems';

export type AddProductItemToShoppingCart = Command<
  'add-product-item-to-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export function addProductItemToShoppingCart(
  events: StreamEvent<ShoppingCartEvent>[],
  command: AddProductItemToShoppingCart,
): Result<ProductItemAddedToShoppingCart, SHOPPING_CARD_CLOSED> {
  const shoppingCart = aggregateStream<
    ShoppingCart,
    StreamEvent<ShoppingCartEvent>
  >(events, when);

  if (shoppingCart.status & ShoppingCartStatus.Closed) {
    return failure('SHOPPING_CARD_CLOSED');
  }

  return success({
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      productItem: command.data.productItem,
    },
  });
}
