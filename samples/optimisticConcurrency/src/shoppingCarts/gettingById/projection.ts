import {
  assertUpdated,
  getMongoCollection,
  retryIfNotFound,
  retryIfNotUpdated,
} from '#core/mongoDB';
import { assertUnreachable, Result, success } from '#core/primitives';
import { Event, StreamEvent } from '#core/events';
import {
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartOpened,
  ShoppingCartStatus,
} from '..';
import { ShoppingCartDetails, SHOPPING_CART_DETAILS } from '.';
import { addProductItem, removeProductItem } from '../productItems';

export async function projectToShoppingCartDetails(
  streamEvent: StreamEvent
): Promise<Result<boolean>> {
  const { event, streamRevision } = streamEvent;

  if (!isCashierShoppingCartDetailsEvent(event)) {
    return success(false);
  }

  switch (event.type) {
    case 'shopping-cart-opened':
      return projectShoppingCartOpened(event, streamRevision);
    case 'product-item-added-to-shopping-cart':
      return projectProductItemAddedToShoppingCart(event, streamRevision);
    case 'product-item-removed-from-shopping-cart':
      return projectProductItemRemovedFromShoppingCart(event, streamRevision);
    case 'shopping-cart-confirmed':
      return projectShoppingCartConfirmed(event, streamRevision);
    default:
      assertUnreachable(event);
  }
}

export async function projectShoppingCartOpened(
  event: ShoppingCartOpened,
  streamRevision: bigint
): Promise<Result<true>> {
  const shoppingCarts = await shoppingCartsCollection();

  await shoppingCarts.insertOne({
    shoppingCartId: event.data.shoppingCartId,
    clientId: event.data.clientId,
    status: ShoppingCartStatus.Opened.toString(),
    productItems: [],
    openedAt: event.data.openedAt,
    revision: streamRevision.toString(),
  });

  return success(true);
}

export async function projectProductItemAddedToShoppingCart(
  event: ProductItemAddedToShoppingCart,
  streamRevision: bigint
): Promise<Result<true>> {
  const shoppingCarts = await shoppingCartsCollection();
  const lastRevision = streamRevision - 1n;

  const { productItems } = await retryIfNotFound(
    shoppingCarts.findOne(
      {
        shoppingCartId: event.data.shoppingCartId,
        revision: lastRevision.toString(),
      },
      { projection: { productItems: 1 } }
    )
  );

  await assertUpdated(
    shoppingCarts.updateOne(
      {
        shoppingCartId: event.data.shoppingCartId,
        revision: lastRevision.toString(),
      },
      {
        $set: {
          productItems: addProductItem(productItems, event.data.productItem),
          revision: streamRevision.toString(),
        },
      },
      { upsert: false }
    )
  );

  return success(true);
}

export async function projectProductItemRemovedFromShoppingCart(
  event: ProductItemRemovedFromShoppingCart,
  streamRevision: bigint
): Promise<Result<true>> {
  const shoppingCarts = await shoppingCartsCollection();
  const lastRevision = streamRevision - 1n;

  const { productItems } = await retryIfNotFound(
    shoppingCarts.findOne(
      {
        shoppingCartId: event.data.shoppingCartId,
        revision: lastRevision.toString(),
      },
      { projection: { productItems: 1 } }
    )
  );

  await assertUpdated(
    shoppingCarts.updateOne(
      {
        shoppingCartId: event.data.shoppingCartId,
        revision: lastRevision.toString(),
      },
      {
        $set: {
          productItems: removeProductItem(productItems, event.data.productItem),
          revision: streamRevision.toString(),
        },
      },
      { upsert: false }
    )
  );

  return success(true);
}

export async function projectShoppingCartConfirmed(
  event: ShoppingCartConfirmed,
  streamRevision: bigint
): Promise<Result<true>> {
  const shoppingCarts = await shoppingCartsCollection();

  const lastRevision = streamRevision - 1n;

  await retryIfNotUpdated(
    shoppingCarts.updateOne(
      {
        shoppingCartId: event.data.shoppingCartId,
        revision: lastRevision.toString(),
      },
      {
        $set: {
          confirmedAt: event.data.confirmedAt,
          status: ShoppingCartStatus.Confirmed.toString(),
          revision: streamRevision.toString(),
        },
      },
      { upsert: false }
    )
  );

  return success(true);
}

type ShoppingCartDetailsEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;

function isCashierShoppingCartDetailsEvent(
  event: Event
): event is ShoppingCartDetailsEvent {
  const eventType = (event as ShoppingCartDetailsEvent).type;

  return (
    eventType === 'shopping-cart-opened' ||
    eventType === 'product-item-added-to-shopping-cart' ||
    eventType === 'product-item-removed-from-shopping-cart' ||
    eventType === 'shopping-cart-confirmed'
  );
}

function shoppingCartsCollection() {
  return getMongoCollection<ShoppingCartDetails>(SHOPPING_CART_DETAILS);
}
