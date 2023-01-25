//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

import { Collection, ObjectId, UpdateResult } from 'mongodb';
import { getMongoCollection, retryIfNotUpdated } from '../core/mongoDB';
import { SubscriptionResolvedEvent } from '../core/subscriptions';
import { ProductItem } from './productItem';
import {
  isCashierShoppingCartEvent,
  ShoppingCartErrors,
  ShoppingCartEvent,
} from './shoppingCart';

export const ShoppingCartStatus = {
  Pending: 'Pending',
  Canceled: 'Canceled',
  Confirmed: 'Confirmed',
};

type ShoppingCartDetails = Readonly<{
  shoppingCartId: string;
  clientId: string;
  status: string;
  productItems: ProductItem[];
  openedAt: string;
  confirmedAt?: string;
  canceledAt?: string;
  revision: number;
}>;

export const getShoppingCartsCollection = () =>
  getMongoCollection<ShoppingCartDetails>('shoppingCartDetails');

export const project = async (
  carts: Collection<ShoppingCartDetails>,
  event: ShoppingCartEvent,
  expectedRevision: number
): Promise<UpdateResult> => {
  switch (event.type) {
    case 'ShoppingCartOpened': {
      return carts.updateOne(
        { _id: new ObjectId(event.data.shoppingCartId) },
        {
          $set: {
            clientId: event.data.clientId,
            status: ShoppingCartStatus.Pending,
            productItems: [],
            openedAt: event.data.openedAt,
            confirmedAt: undefined,
            revision: expectedRevision,
          },
        },
        { upsert: true }
      );
    }
    case 'ProductItemAddedToShoppingCart': {
      await carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          'productItems.productId': { $ne: event.data.productItem.productId },
        },
        {
          $addToSet: {
            productItems: {
              productId: event.data.productItem.productId,
              quantity: 0,
            },
          },
        }
      );

      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          revision: expectedRevision,
        },
        {
          $inc: {
            'productItems.$[orderItem].quantity':
              event.data.productItem.quantity,
            revision: 1,
          },
        },
        {
          arrayFilters: [
            {
              'orderItem.productId': event.data.productItem.productId,
            },
          ],
          upsert: true,
        }
      );
    }
    case 'ProductItemRemovedFromShoppingCart': {
      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          'productItems.productId': event.data.productItem.productId,
          revision: expectedRevision,
        },
        {
          $inc: {
            'productItems.$.quantity': -event.data.productItem.quantity,
            revision: 1,
          },
        },
        { upsert: false }
      );
    }
    case 'ShoppingCartConfirmed': {
      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          revision: expectedRevision,
        },
        {
          $set: {
            status: ShoppingCartStatus.Confirmed,
            confirmedAt: event.data.confirmedAt,
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false }
      );
    }
    case 'ShoppingCartCanceled': {
      return carts.updateOne(
        {
          _id: new ObjectId(event.data.shoppingCartId),
          revision: expectedRevision,
        },
        {
          $set: {
            status: ShoppingCartStatus.Confirmed,
            canceledAt: event.data.canceledAt,
          },
          $inc: {
            revision: 1,
          },
        },
        { upsert: false }
      );
    }
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

export const projectToShoppingCartDetails = async (
  resolvedEvent: SubscriptionResolvedEvent
): Promise<void> => {
  if (
    resolvedEvent.event === undefined ||
    !isCashierShoppingCartEvent(resolvedEvent.event)
  )
    return Promise.resolve();

  const { event } = resolvedEvent;
  const streamRevision = Number(event.revision);
  const expectedRevision = streamRevision - 1;
  const shoppingCarts = await getShoppingCartsCollection();

  await retryIfNotUpdated(() =>
    project(shoppingCarts, event, expectedRevision)
  );
};
