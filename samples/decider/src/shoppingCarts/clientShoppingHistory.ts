import {
  EmptyUpdateResult,
  getMongoCollection,
  retryIfNotFound,
} from '#core/mongoDB';
import { SubscriptionResolvedEvent } from '#core/subscriptions';
import { Collection, Long, MongoClient, ObjectId, UpdateResult } from 'mongodb';
import {
  isCashierShoppingCartEvent,
  ShoppingCartErrors,
  ShoppingCartEvent,
} from './shoppingCart';

export type PendingShoppingCart = {
  shoppingCartId: string;
  totalProductsCount: number;
  totalAmount: number;
  isDeleted: boolean;
};

export type ClientShoppingHistory = Readonly<{
  totalProductsCount: number;
  totalAmount: number;
  pending: PendingShoppingCart[];
  position: number | Long;
}>;

export const getClientShoppingHistoryCollection = (mongo: MongoClient) =>
  getMongoCollection<ClientShoppingHistory>(mongo, 'clientShoppingHistory');

const project = async (
  clientShoppingHistory: Collection<ClientShoppingHistory>,
  { type, data: event }: ShoppingCartEvent,
  eventPosition: Long
): Promise<UpdateResult> => {
  switch (type) {
    case 'ShoppingCartOpened': {
      await clientShoppingHistory.updateOne(
        { _id: new ObjectId(event.clientId) },
        {
          $setOnInsert: {
            totalProductsCount: 0,
            totalAmount: 0,
            pending: [],
            position: Long.fromNumber(-1),
          },
        },
        { upsert: true }
      );

      return clientShoppingHistory.updateOne(
        { _id: new ObjectId(event.clientId), position: { $lt: eventPosition } },
        {
          $set: {
            position: eventPosition,
          },
          $addToSet: {
            pending: {
              shoppingCartId: event.shoppingCartId,
              totalAmount: 0,
              totalProductsCount: 0,
              isDeleted: false,
            },
          },
        }
      );
    }
    case 'ProductItemAddedToShoppingCart': {
      return clientShoppingHistory.updateOne(
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
      return clientShoppingHistory.updateOne(
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
      const history = await retryIfNotFound(() =>
        clientShoppingHistory.findOne(
          {
            position: { $lt: eventPosition },
            'pending.shoppingCartId': event.shoppingCartId,
          },
          {
            projection: {
              'pending.$': 1,
            },
          }
        )
      ).catch(console.warn);

      if (!history || history.pending.length === 0) return EmptyUpdateResult;

      return clientShoppingHistory.updateOne(
        {
          position: { $lt: eventPosition },
          'pending.shoppingCartId': event.shoppingCartId,
        },
        [
          {
            $set: {
              totalProductsCount: {
                $add: [
                  '$totalProductsCount',
                  history.pending[0].totalProductsCount,
                ],
              },
              totalAmount: {
                $add: ['$totalAmount', history.pending[0].totalAmount],
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalProductsCount: 0,
              totalAmount: 0,
              position: 0,
              pending: {
                $filter: {
                  input: '$pending',
                  as: 'item',
                  cond: {
                    $ne: ['$$item.shoppingCartId', event.shoppingCartId],
                  },
                },
              },
            },
          },
        ]
      );
    }
    case 'ShoppingCartCanceled': {
      return clientShoppingHistory.updateOne(
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

export const projectToClientShoppingHistory =
  (mongo: MongoClient) =>
  (resolvedEvent: SubscriptionResolvedEvent): Promise<UpdateResult> => {
    const event = resolvedEvent.event;
    if (event === undefined) return Promise.resolve(EmptyUpdateResult);

    const eventPosition = event.position.commit;

    if (event === undefined || !isCashierShoppingCartEvent(event))
      return Promise.resolve(EmptyUpdateResult);

    const shoppingHistory = getClientShoppingHistoryCollection(mongo);

    return project(shoppingHistory, event, Long.fromBigInt(eventPosition));
  };
