//////////////////////////////////////
/// ShoppingCartDetails projection
//////////////////////////////////////

import { SQL } from '@event-driven-io/dumbo';
import { postgreSQLRawSQLProjection } from '@event-driven-io/emmett-postgresql';
import type {
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartEvent,
  ShoppingCartOpened,
} from './shoppingCart';
import { ShoppingCartErrors, ShoppingCartStatus } from './shoppingCart';

export const shoppingCartDetailsProjection =
  postgreSQLRawSQLProjection<ShoppingCartEvent>({
    name: 'shopping_cart_details',
    canHandle: [
      'shopping-cart-opened',
      'product-item-added-to-shopping-cart',
      'product-item-removed-from-shopping-cart',
      'shopping-cart-confirmed',
    ],
    evolve: (event) => {
      switch (event.type) {
        case 'shopping-cart-opened':
          return projectShoppingCartOpened(event);
        case 'product-item-added-to-shopping-cart':
          return projectProductItemAddedToShoppingCart(event);
        case 'product-item-removed-from-shopping-cart':
          return projectProductItemRemovedFromShoppingCart(event);
        case 'shopping-cart-confirmed':
          return projectShoppingCartConfirmed(event);
        default: {
          const _: never = event;
          throw new Error(ShoppingCartErrors.UNKNOWN_EVENT_TYPE);
        }
      }
    },
  });

export const projectShoppingCartOpened = ({
  data: { shoppingCartId, openedAt },
}: ShoppingCartOpened): SQL =>
  SQL`
    INSERT INTO "ecommerce"."cart" ("sessionId", "status", "createdAt")
    VALUES (${shoppingCartId}, ${ShoppingCartStatus.Opened}, ${openedAt})
    ON CONFLICT ("sessionId") DO NOTHING;`;

export const projectProductItemAddedToShoppingCart = ({
  data: {
    shoppingCartId,
    productItem: { productId, quantity, discount, price, sku },
    addedAt,
  },
}: ProductItemAddedToShoppingCart): SQL[] => [
  SQL`
    INSERT INTO "ecommerce"."cart_item" AS ci ("cartId", "productId", "sku", "price", "discount", "quantity", "createdAt")
    VALUES (
      (SELECT "id" FROM "ecommerce"."cart" WHERE "sessionId" = ${shoppingCartId}),
      ${productId}, ${sku}, ${price}, ${discount}, ${quantity}, ${addedAt}
    )
    ON CONFLICT ("cartId", "productId") DO UPDATE SET "quantity" = EXCLUDED."quantity" + ci."quantity", "updatedAt" = ${addedAt};`,
  updateCartUpdatedAt(shoppingCartId, addedAt),
];

export const projectProductItemRemovedFromShoppingCart = ({
  data: {
    shoppingCartId,
    productItem: { productId, quantity },
    removedAt,
  },
}: ProductItemRemovedFromShoppingCart): SQL[] => [
  SQL`
    UPDATE "ecommerce"."cart_item"
    SET "quantity" = "quantity" - ${quantity}, "updatedAt" = ${removedAt}
    WHERE "cartId" = (SELECT "id" FROM "ecommerce"."cart" WHERE "sessionId" = ${shoppingCartId})
      AND "productId" = ${productId};`,
  SQL`
    DELETE FROM "ecommerce"."cart_item"
    WHERE "cartId" = (SELECT "id" FROM "ecommerce"."cart" WHERE "sessionId" = ${shoppingCartId})
      AND "productId" = ${productId} AND "quantity" = 0;`,
  updateCartUpdatedAt(shoppingCartId, removedAt),
];

export const projectShoppingCartConfirmed = ({
  data: {
    shoppingCartId,
    user: {
      id: userId,
      firstName,
      lastName,
      middleName,
      mobile,
      email,
      address,
    },
    additionalInfo: { content, line1, line2 },
    confirmedAt,
  },
}: ShoppingCartConfirmed): SQL =>
  SQL`
    UPDATE "ecommerce"."cart"
    SET "userId" = ${userId},
      "firstName" = ${firstName},
      "lastName" = ${lastName},
      "middleName" = ${middleName ?? null},
      "mobile" = ${mobile ?? null},
      "email" = ${email},
      "content" = ${content ?? null},
      "line1" = ${line1 ?? null},
      "line2" = ${line2 ?? null},
      "city" = ${address.city},
      "province" = ${address.province},
      "country" = ${address.country},
      "status" = ${ShoppingCartStatus.Confirmed},
      "updatedAt" = ${confirmedAt}
    WHERE "sessionId" = ${shoppingCartId};`;

const updateCartUpdatedAt = (shoppingCartId: string, updatedAt: string): SQL =>
  SQL`
    UPDATE "ecommerce"."cart"
    SET "updatedAt" = ${updatedAt}
    WHERE "sessionId" = ${shoppingCartId};`;
