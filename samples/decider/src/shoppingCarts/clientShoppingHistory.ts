import { getMongoCollection, retryIfNotUpdated } from '#core/mongoDB';
import { SubscriptionResolvedEvent } from '#core/subscriptions';
import { Collection, Long, ObjectId, UpdateResult } from 'mongodb';
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

type ClientShoppingHistory = Readonly<{
  totalProductsCount: number;
  totalAmount: number;
  pending: {
    shoppingCartId: string;
    totalProductsCount: number;
    totalAmount: number;
  }[];
  position: Long;
}>;

export const getClientShoppingHistoryCollection = () =>
  getMongoCollection<ClientShoppingHistory>('clientShoppingHistory');

export const project = async (
  carts: Collection<ClientShoppingHistory>,
  { type, data: event }: ShoppingCartEvent,
  eventPosition: Long
): Promise<UpdateResult> => {
  switch (type) {
    case 'ShoppingCartOpened': {
      await carts.updateOne(
        { _id: new ObjectId(event.clientId) },
        {
          $setOnInsert: {
            totalProductsCount: 0,
            totalAmount: 0,
            pending: [],
            position: Long.fromNumber(0),
          },
        },
        { upsert: true }
      );

      return carts.updateOne(
        { _id: new ObjectId(event.clientId), position: { $lt: eventPosition } },
        {
          $addToSet: {
            pending: {
              shoppingCartId: event.shoppingCartId,
              totalAmount: 0,
              totalProductsCount: 0,
            },
          },
        }
      );
    }
    case 'ProductItemAddedToShoppingCart': {
      return carts.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        {
          $inc: {
            'pending.$.quantity': event.productItem.quantity,
            'pending.$.totalAmount':
              event.productItem.quantity * event.productItem.price,
          },
          $set: {
            position: eventPosition,
          },
        }
      );
    }
    case 'ProductItemRemovedFromShoppingCart': {
      return carts.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        {
          $inc: {
            'pending.$.quantity': -event.productItem.quantity,
            'pending.$.totalAmount':
              -event.productItem.quantity * event.productItem.price,
          },
          $set: {
            position: eventPosition,
          },
        }
      );
    }
    case 'ShoppingCartConfirmed': {
      return carts.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        [
          {
            $inc: {
              totalProductsCount: 'pending.$.totalProductsCount',
              totalProductsAmount: 'pending.$.totalProductsAmount',
            },
          },
          {
            $pull: {
              pending: {
                shoppingCartId: event.shoppingCartId,
              },
            },
          },
        ]
      );
    }
    case 'ShoppingCartCanceled': {
      return carts.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        {
          $pull: {
            pending: {
              shoppingCartId: event.shoppingCartId,
            },
          },
        }
      );
    }
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

export const projectToClientShoppingHistory = async (
  resolvedEvent: SubscriptionResolvedEvent
): Promise<void> => {
  const event = resolvedEvent.event;
  if (event === undefined) return Promise.resolve();
  const eventPosition = event.position.commit;

  if (event === undefined || !isCashierShoppingCartEvent(event))
    return Promise.resolve();

  const summary = await getClientShoppingHistoryCollection();

  await project(summary, event, Long.fromBigInt(eventPosition));
};
