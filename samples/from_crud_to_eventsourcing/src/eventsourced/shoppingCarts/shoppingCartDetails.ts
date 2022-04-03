//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

import { getPostgres } from '#core/postgres';
import { SubscriptionResolvedEvent } from '#eventsourced/core/subscriptions';
import { carts, cartItems } from '../db';
import {
  isCashierShoppingCartEvent,
  ShoppingCartErrors,
  ShoppingCartOpened,
  ShoppingCartStatus,
} from './shoppingCart';

export const getShoppingCarts = () => carts(getPostgres());
export const getShoppingCartItemss = () => cartItems(getPostgres());

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
      return Promise.resolve(); // projectProductItemAddedToShoppingCart(event, streamRevision);
    case 'product-item-removed-from-shopping-cart':
      return Promise.resolve(); // projectProductItemRemovedFromShoppingCart(event, streamRevision);
    case 'shopping-cart-confirmed':
      return Promise.resolve(); // projectShoppingCartConfirmed(event, streamRevision);
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
  const shoppingCarts = getShoppingCarts();

  await shoppingCarts.insertOrIgnore({
    sessionId: event.data.shoppingCartId,
    createdAt: new Date(event.data.openedAt),
    status: ShoppingCartStatus.Opened,
    revision: streamRevision,
    //   updatedAt: new Date(),
    // city?: (string) | null
    // content?: (string) | null
    // country?: (string) | null
    // createdAt: Date
    // email?: (string) | null
    // firstName?: (string) | null
    // lastName?: (string) | null
    // line1?: (string) | null
    // line2?: (string) | null
    // middleName?: (string) | null
    // mobile?: (string) | null
    // province?: (string) | null
    // status?: number
    // token: string
    // updatedAt?: (Date) | null
    // userId: number | null,
  });
};

// export const projectProductItemAddedToShoppingCart = async (
//   event: ProductItemAddedToShoppingCart,
//   streamRevision: number
// ): Promise<void> => {
//   // const shoppingCarts = getShoppingCarts();
//   // const lastRevision = streamRevision - 1;

//   // const { revision } = await retryIfNotFound(() =>
//   //   shoppingCarts.findOne({
//   //     id: event.data.shoppingCartId,
//   //     revision: { $gte: lastRevision },
//   //   })
//   // );

//   // if (revision > lastRevision) {
//   //   return;
//   // }

//   const result = await getPostgres().task(async (db) => {
//     var shoppingCarts = carts(db);

//     const revision =

//     const resultA = await db.query(sql`SELECT 1 + 1 AS a`);
//     const resultB = await db.query(sql`SELECT 1 + 1 AS b`);

//     return resultA[0].a + resultB[0].b;
//   });

//   retryIfNotUpdated(() =>
//     shoppingCarts.updateOne(
//       {
//         _id: toObjectId(event.data.shoppingCartId),
//         revision: lastRevision,
//       },
//       {
//         $set: {
//           productItems: addProductItem(productItems, event.data.productItem),
//           revision: streamRevision,
//         },
//       },
//       { upsert: false }
//     )
//   );
// };

// export const projectProductItemRemovedFromShoppingCart = async (
//   event: ProductItemRemovedFromShoppingCart,
//   streamRevision: number
// ): Promise<void> => {
//   const shoppingCarts = await getShoppingCarts();
//   const lastRevision = streamRevision - 1;

//   const { productItems, revision } = await retryIfNotFound(() =>
//     shoppingCarts.findOne(
//       {
//         _id: toObjectId(event.data.shoppingCartId),
//         revision: { $gte: lastRevision },
//       },
//       {
//         projection: { productItems: 1, revision: 1 },
//       }
//     )
//   );
//   if (revision > lastRevision) {
//     return;
//   }

//   await retryIfNotUpdated(() =>
//     shoppingCarts.updateOne(
//       {
//         _id: toObjectId(event.data.shoppingCartId),
//         revision: lastRevision,
//       },
//       {
//         $set: {
//           productItems: removeProductItem(productItems, event.data.productItem),
//           revision: streamRevision,
//         },
//       },
//       { upsert: false }
//     )
//   );
// };

// export const projectShoppingCartConfirmed = async (
//   event: ShoppingCartConfirmed,
//   streamRevision: number
// ): Promise<void> => {
//   const shoppingCarts = await getShoppingCarts();

//   const lastRevision = streamRevision - 1;

//   const { revision } = await retryIfNotFound(() =>
//     shoppingCarts.findOne(
//       {
//         _id: toObjectId(event.data.shoppingCartId),
//         revision: { $gte: lastRevision },
//       },
//       { projection: { revision: 1 } }
//     )
//   );

//   if (revision > lastRevision) {
//     return;
//   }

//   await shoppingCarts.updateOne(
//     {
//       _id: toObjectId(event.data.shoppingCartId),
//       revision: lastRevision,
//     },
//     {
//       $set: {
//         confirmedAt: event.data.confirmedAt,
//         status: ShoppingCartStatus.Confirmed.toString(),
//         revision: streamRevision,
//       },
//     },
//     { upsert: false }
//   );
// };
