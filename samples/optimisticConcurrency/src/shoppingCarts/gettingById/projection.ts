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
import { CurrentShoppingCartDetails, CURRENT_SHOPPING_CART_DETAILS } from '.';
import { addProductItem, removeProductItem } from '../productItems';

export async function projectShoppingCartOpened(
  event: ShoppingCartOpened,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<CurrentShoppingCartDetails>(
    { collectionName: CURRENT_SHOPPING_CART_DETAILS },
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
  await executeOnMongoDB<CurrentShoppingCartDetails>(
    { collectionName: CURRENT_SHOPPING_CART_DETAILS },
    async (collection) => {
      const { productItems } = (await collection.findOne(
        {
          shoppingCartId: event.data.shoppingCartId,
        },
        { projection: { productItems: 1 } }
      ))!;

      await collection.findOneAndUpdate(
        {
          shoppingCartId: event.data.shoppingCartId,
        },
        {
          $set: {
            productItems: addProductItem(productItems, event.data.productItem),
            revision: streamRevision.toString(),
          },
        }
      );
    }
  );

  return success(true);
}

export async function projectProductItemRemovedFromShoppingCart(
  event: ProductItemRemovedFromShoppingCart,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<CurrentShoppingCartDetails>(
    { collectionName: CURRENT_SHOPPING_CART_DETAILS },
    async (collection) => {
      const { productItems } = (await collection.findOne(
        {
          shoppingCartId: event.data.shoppingCartId,
        },
        { projection: { productItems: 1 } }
      ))!;

      await collection.findOneAndUpdate(
        {
          shoppingCartId: event.data.shoppingCartId,
        },
        {
          $set: {
            productItems: removeProductItem(
              productItems,
              event.data.productItem
            ),
            revision: streamRevision.toString(),
          },
        }
      );
    }
  );

  return success(true);
}

export async function projectShoppingCartConfirmed(
  event: ShoppingCartConfirmed,
  streamRevision: bigint
): Promise<Result<true>> {
  await executeOnMongoDB<CurrentShoppingCartDetails>(
    { collectionName: CURRENT_SHOPPING_CART_DETAILS },
    async (collection) => {
      await collection.updateOne(
        {
          shoppingCartId: event.data.shoppingCartId,
        },
        {
          $set: {
            confirmedAt: event.data.confirmedAt,
            status: ShoppingCartStatus.Confirmed.toString(),
            revision: streamRevision.toString(),
          },
        }
      );
    }
  );

  return success(true);
}

type CurrentShoppingCartDetailsEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;

function isCashierShoppingCartDetailsEvent(
  event: Event
): event is CurrentShoppingCartDetailsEvent {
  const eventType = (event as CurrentShoppingCartDetailsEvent).type;

  return (
    eventType === 'shopping-cart-opened' ||
    eventType === 'product-item-added-to-shopping-cart' ||
    eventType === 'product-item-removed-from-shopping-cart' ||
    eventType === 'shopping-cart-confirmed'
  );
}

export async function projectToCurrentShoppingCartDetails(
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
