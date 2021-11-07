import { executeOnMongoDB } from '#core/mongoDB';
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
import { retryPromise } from '#core/http/requests';

export async function projectShoppingCartOpened(
  event: ShoppingCartOpened,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<ShoppingCartDetails>(
    { collectionName: SHOPPING_CART_DETAILS },
    async (collection) => {
      await collection.insertOne({
        shoppingCartId: event.data.shoppingCartId,
        clientId: event.data.clientId,
        status: ShoppingCartStatus.Opened.toString(),
        productItems: [],
        openedAt: event.data.openedAt,
        revision: streamRevision.toString(),
      });
    }
  );

  return success(true);
}

export async function projectProductItemAddedToShoppingCart(
  event: ProductItemAddedToShoppingCart,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<ShoppingCartDetails>(
    { collectionName: SHOPPING_CART_DETAILS },
    async (collection) =>
      retryPromise(async () => {
        const lastRevision = BigInt(streamRevision) - 1n;
        const shoppingCart = await collection.findOne(
          {
            shoppingCartId: event.data.shoppingCartId,
            revision: lastRevision.toString(),
          },
          { projection: { productItems: 1 } }
        );

        if (shoppingCart === null) {
          throw 'Shopping cart was not found or not up to date';
        }

        const { productItems } = shoppingCart;

        const result = await collection.updateOne(
          {
            shoppingCartId: event.data.shoppingCartId,
            revision: lastRevision.toString(),
          },
          {
            $set: {
              productItems: addProductItem(
                productItems,
                event.data.productItem
              ),
              revision: streamRevision.toString(),
            },
          },
          { upsert: false }
        );

        if (result.modifiedCount == 0) {
          throw 'Failed to remove product item';
        }
      })
  );

  return success(true);
}

export async function projectProductItemRemovedFromShoppingCart(
  event: ProductItemRemovedFromShoppingCart,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<ShoppingCartDetails>(
    { collectionName: SHOPPING_CART_DETAILS },
    async (collection) =>
      retryPromise(async () => {
        const lastRevision = BigInt(streamRevision) - 1n;
        const shoppingCart = await collection.findOne(
          {
            shoppingCartId: event.data.shoppingCartId,
            revision: lastRevision.toString(),
          },
          { projection: { productItems: 1 } }
        );

        if (shoppingCart === null) {
          throw 'Shopping cart was not found or not up to date';
        }

        const { productItems } = shoppingCart;

        const result = await collection.updateOne(
          {
            shoppingCartId: event.data.shoppingCartId,
            revision: lastRevision.toString(),
          },
          {
            $set: {
              productItems: removeProductItem(
                productItems,
                event.data.productItem
              ),
              revision: streamRevision.toString(),
            },
          },
          { upsert: false }
        );

        if (result.modifiedCount == 0) {
          throw 'Failed to remove product item';
        }
      })
  );

  return success(true);
}

export async function projectShoppingCartConfirmed(
  event: ShoppingCartConfirmed,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<ShoppingCartDetails>(
    { collectionName: SHOPPING_CART_DETAILS },
    async (collection) =>
      retryPromise(async () => {
        const lastRevision = BigInt(streamRevision) - 1n;
        const result = await collection.updateOne(
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
        );

        if (result.modifiedCount == 0) {
          throw 'Failed to confirm shopping cart';
        }
      })
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
