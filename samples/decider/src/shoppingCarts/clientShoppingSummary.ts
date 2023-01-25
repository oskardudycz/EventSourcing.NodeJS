import { getMongoCollection, retryIfNotUpdated } from "#core/mongoDB";
import { SubscriptionResolvedEvent } from "#core/subscriptions";
import { Collection, Long, ObjectId, UpdateResult } from "mongodb";
import { isCashierShoppingCartEvent, ShoppingCartErrors, ShoppingCartEvent } from "./shoppingCart";

export const ShoppingCartStatus = {
  Pending: 'Pending',
  Canceled: 'Canceled',
  Confirmed: 'Confirmed',
};

type ClientShoppingHistory = Readonly<{
  totalProductsCount: number; 
  totalAmount: number;
  pending: {shoppingCartId: string, totalProductsCount: number; totalAmount: number}[]
  position: Long;
}>;

export const getClientShoppingHistoryCollection = () =>
  getMongoCollection<ClientShoppingHistory>('clientShoppingHistory');


  export const project = async (
    carts: Collection<ClientShoppingHistory>,
    {type, data: event}: ShoppingCartEvent,
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
              position: Long.fromNumber(0)
            },
          },
          { upsert: true }
        );

        return carts.updateOne(
          { _id: new ObjectId(event.clientId), position: {$gt: eventPosition }},
          {
            $addToSet: {
              pending: {
                shoppingCartId: event.shoppingCartId,
                totalAmount: 0,
                totalProductsCount: 0
              },
            },
            $setOnInsert: {
              totalProductsCount: 0,
              totalAmount: 0,
              pending: [],
              position: eventPosition
            },
          },
          { upsert: false }
        );
      }
      case 'ProductItemAddedToShoppingCart': {
        return carts.updateOne(
          { position: {$gt: eventPosition },
            'pending.shoppingCartId': event.shoppingCartId,},
          {
            $inc: {
              'pending.$.quantity': event.productItem.quantity,
              'pending.$.totalAmount': event.productItem.quantity * event.productItem.price,
            },
            $set:{
              position: eventPosition
            }
          }
        );
      }
      case 'ProductItemRemovedFromShoppingCart': {
        return carts.updateOne(
          { position: {$gt: eventPosition },
            'pending.shoppingCartId': event.shoppingCartId,},
          {
            $inc: {
              'pending.$.quantity': -event.productItem.quantity,
              'pending.$.totalAmount': -event.productItem.quantity //TODO!* event.productItem.price,
            },
            $set:{
              position: eventPosition
            }
          }
        );
      }
      case 'ShoppingCartConfirmed': {
        return carts.updateOne(
          { position: {$gt: eventPosition },
            'pending.shoppingCartId': event.shoppingCartId,},
          [{
            $inc: 1
          }],
          { upsert: false }
        );
      }
      case 'ShoppingCartCanceled': {
        return carts.updateOne(
          { position: {$gt: eventPosition },
            'pending.shoppingCartId': event.shoppingCartId,},
          [{
            $inc: 1
          }],
          { upsert: false }
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
    if (
      event === undefined
      )
        return Promise.resolve();
    const eventData = event.data;
    const eventPosition = event.position
    if (
      event === undefined ||
      !isCashierShoppingCartEvent(eventData)
    )
      return Promise.resolve();
  
    const shoppingCarts = await getClientShoppingHistoryCollection();
  
    await retryIfNotUpdated(() => project(shoppingCarts, eventData, Long.fromBigInt(event.position.commit)));
  };
  