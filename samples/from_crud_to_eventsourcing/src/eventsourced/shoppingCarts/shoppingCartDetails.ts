//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

import {
  getMongoCollection,
  retryIfNotFound,
  retryIfNotUpdated,
  toObjectId,
} from '../../core/mongoDB';
import { SubscriptionResolvedEvent } from '../core/subscriptions';
import { ProductItem, addProductItem, removeProductItem } from './productItem';
import {
  isCashierShoppingCartEvent,
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartErrors,
  ShoppingCartOpened,
  ShoppingCartStatus,
} from './shoppingCart';

export const getShoppingCartsCollection = () =>
  getMongoCollection<ShoppingCartDetails>('shoppingCartDetails');

type ShoppingCartDetails = Readonly<{
  shoppingCartId: string;
  clientId: string;
  status: string;
  productItems: ProductItem[];
  openedAt: string;
  confirmedAt?: string;
  revision: number;
}>;

export const projectToShoppingCartItem = (
  resolvedEvent: SubscriptionResolvedEvent
): Promise<void> => {
  if (
    resolvedEvent.event === undefined ||
    !isCashierShoppingCartEvent(resolvedEvent.event)
  )
    return Promise.resolve();

  const { event } = resolvedEvent;
  const streamRevision = Number(event.revision);

  switch (event.type) {
    case 'shopping-cart-opened':
      return projectShoppingCartOpened(event, streamRevision);
    case 'product-item-added-to-shopping-cart':
      return projectProductItemAddedToShoppingCart(event, streamRevision);
    case 'product-item-removed-from-shopping-cart':
      return projectProductItemRemovedFromShoppingCart(event, streamRevision);
    case 'shopping-cart-confirmed':
      return projectShoppingCartConfirmed(event, streamRevision);
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

export const projectShoppingCartOpened = async (
  event: ShoppingCartOpened,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();

  await shoppingCarts.insertOne({
    _id: toObjectId(event.data.shoppingCartId),
    shoppingCartId: event.data.shoppingCartId,
    clientId: event.data.clientId,
    status: ShoppingCartStatus.Opened.toString(),
    productItems: [],
    revision: streamRevision,
    openedAt: event.data.openedAt,
  });
};

export const projectProductItemAddedToShoppingCart = async (
  event: ProductItemAddedToShoppingCart,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();
  const lastRevision = streamRevision - 1;

  const { productItems, revision } = await retryIfNotFound(() =>
    shoppingCarts.findOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: { $gte: lastRevision },
      },
      {
        projection: { productItems: 1, revision: 1 },
      }
    )
  );

  if (revision > lastRevision) {
    return;
  }

  retryIfNotUpdated(() =>
    shoppingCarts.updateOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: lastRevision,
      },
      {
        $set: {
          productItems: addProductItem(productItems, event.data.productItem),
          revision: streamRevision,
        },
      },
      { upsert: false }
    )
  );
};

export const projectProductItemRemovedFromShoppingCart = async (
  event: ProductItemRemovedFromShoppingCart,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();
  const lastRevision = streamRevision - 1;

  const { productItems, revision } = await retryIfNotFound(() =>
    shoppingCarts.findOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: { $gte: lastRevision },
      },
      {
        projection: { productItems: 1, revision: 1 },
      }
    )
  );
  if (revision > lastRevision) {
    return;
  }

  await retryIfNotUpdated(() =>
    shoppingCarts.updateOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: lastRevision,
      },
      {
        $set: {
          productItems: removeProductItem(productItems, event.data.productItem),
          revision: streamRevision,
        },
      },
      { upsert: false }
    )
  );
};

export const projectShoppingCartConfirmed = async (
  event: ShoppingCartConfirmed,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = await getShoppingCartsCollection();

  const lastRevision = streamRevision - 1;

  const { revision } = await retryIfNotFound(() =>
    shoppingCarts.findOne(
      {
        _id: toObjectId(event.data.shoppingCartId),
        revision: { $gte: lastRevision },
      },
      { projection: { revision: 1 } }
    )
  );

  if (revision > lastRevision) {
    return;
  }

  await shoppingCarts.updateOne(
    {
      _id: toObjectId(event.data.shoppingCartId),
      revision: lastRevision,
    },
    {
      $set: {
        confirmedAt: event.data.confirmedAt,
        status: ShoppingCartStatus.Confirmed.toString(),
        revision: streamRevision,
      },
    },
    { upsert: false }
  );
};
