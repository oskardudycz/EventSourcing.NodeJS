//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

import { Collection, ObjectId, UpdateResult } from 'mongodb';
import { getMongoCollection } from '../core/mongoDB';
import { SubscriptionResolvedEvent } from '../core/subscriptions';
import { PricedProductItem } from './productItem';
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
  productItems: PricedProductItem[];
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
  streamRevision: number
): Promise<UpdateResult> => {
  const expectedRevision = streamRevision - 1;
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
            revision: streamRevision,
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
          'productItems.price': { $ne: event.data.productItem.price },
        },
        {
          $addToSet: {
            productItems: {
              productId: event.data.productItem.productId,
              quantity: 0,
              price: event.data.productItem.price,
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
            'productItems.$[productItem].quantity':
              event.data.productItem.quantity,
            revision: 1,
          },
        },
        {
          arrayFilters: [
            {
              'productItem.productId': event.data.productItem.productId,
              'productItem.price': event.data.productItem.price,
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
  const shoppingCarts = await getShoppingCartsCollection();

  await project(shoppingCarts, event, streamRevision);
};
