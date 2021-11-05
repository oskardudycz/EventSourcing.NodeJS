import { StreamEvent } from '#core/events';
import { Command } from '#core/commands';
import { failure, Result, success } from '#core/primitives';
import {
  ProductItemRemovedFromShoppingCart,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
  SHOPPING_CARD_CLOSED,
  when,
} from '..';
import { aggregateStream } from '#core/streams';
import { findProductItem, ProductItem } from '../productItems';

export type RemoveProductItemFromShoppingCart = Command<
  'remove-product-item-from-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export type NOT_ENOUGH_PRODUCT_IN_SHOPPING_CART =
  'NOT_ENOUGH_PRODUCT_IN_SHOPPING_CART';

export function handleRemovingProductItemFromShoppingCart(
  events: StreamEvent<ShoppingCartEvent>[],
  command: RemoveProductItemFromShoppingCart
): Result<
  ProductItemRemovedFromShoppingCart,
  SHOPPING_CARD_CLOSED | NOT_ENOUGH_PRODUCT_IN_SHOPPING_CART
> {
  const shoppingCart = aggregateStream<
    ShoppingCart,
    StreamEvent<ShoppingCartEvent>
  >(events, when);

  if (shoppingCart.status & ShoppingCartStatus.Closed) {
    return failure('SHOPPING_CARD_CLOSED');
  }

  const { productId, quantity } = command.data.productItem;

  const currentProductItem = findProductItem(
    shoppingCart.productItems,
    productId
  );

  if (
    currentProductItem === undefined ||
    currentProductItem.quantity < quantity
  ) {
    return failure('NOT_ENOUGH_PRODUCT_IN_SHOPPING_CART');
  }

  return success({
    type: 'product-item-removed-from-shopping-cart',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      productItem: command.data.productItem,
    },
  });
}
