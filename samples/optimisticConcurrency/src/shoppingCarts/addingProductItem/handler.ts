import { StreamEvent } from '#core/events';
import { Command } from '#core/commands';
import { failure, Result, success } from '#core/primitives';
import {
  ProductItemAddedToShoppingCart,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
  SHOPPING_CARD_CLOSED,
  when,
} from '..';
import { aggregateStream } from '#core/streams';
import { ProductItem } from '../productItems';

export type AddProductItemToShoppingCart = Command<
  'add-product-item-to-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export function handleAddingProductItemToShoppingCart(
  events: StreamEvent<ShoppingCartEvent>[],
  command: AddProductItemToShoppingCart
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
