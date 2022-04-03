//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

import { getPostgres } from '#core/postgres';
import { SubscriptionResolvedEvent } from '#eventsourced/core/subscriptions';
import { sql, Transaction } from '@databases/pg';
import { cartItems, carts } from '../db';
import {
  isCashierShoppingCartEvent,
  ProductItemAddedToShoppingCart,
  ShoppingCartErrors,
  ShoppingCartOpened,
  ShoppingCartStatus,
} from './shoppingCart';

export const getShoppingCarts = () => carts(getPostgres());
export const getShoppingCartItemss = () => cartItems(getPostgres());

export const projectToShoppingCartItem = (
  db: Transaction,
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
      return projectShoppingCartOpened(db, event, streamRevision);
    case 'product-item-added-to-shopping-cart':
      return projectProductItemAddedToShoppingCart(db, event, streamRevision);
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
  db: Transaction,
  event: ShoppingCartOpened,
  streamRevision: number
): Promise<void> => {
  const shoppingCarts = carts(db);

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

export const projectProductItemAddedToShoppingCart = async (
  db: Transaction,
  event: ProductItemAddedToShoppingCart,
  streamRevision: number
): Promise<void> => {
  const {
    shoppingCartId,
    productItem: { productId, quantity },
    addedAt,
  } = event.data;

  const { wasApplied, cartId } = await wasAlreadyApplied(
    db,
    shoppingCartId,
    streamRevision
  );

  if (wasApplied) {
    return;
  }

  const shoppingCartsItems = cartItems(db);

  // TODO: extend with SKU
  const sku = 'NOT_REAL_SKU';
  const price = 123;
  const discount = 0;

  await db.query(
    sql`
    INSERT INTO ${shoppingCartsItems.tableId} as ci ("cartId", "productId", "sku", "price", "discount", "quantity", "createdAt")
    VALUES (${cartId}, ${productId}, ${sku}, ${price}, ${discount}, ${quantity}, ${addedAt})
    ON CONFLICT ("cartId", "productId") DO UPDATE SET "quantity" = EXCLUDED."quantity" + ci."quantity";
    `
  );
};

const wasAlreadyApplied = async (
  db: Transaction,
  shoppingCartId: string,
  streamRevision: number
) => {
  const shoppingCarts = carts(db);
  const result = await shoppingCarts.update(
    { sessionId: shoppingCartId, revision: streamRevision - 1 },
    {
      revision: streamRevision,
    }
  );

  return {
    wasApplied: result.length === 0,
    cartId: result.length > 0 ? result[0].id : undefined,
  };
};

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
