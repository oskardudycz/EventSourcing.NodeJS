import { z } from 'zod';
import type {
  ProductItemAddedToShoppingCart,
  ProductItemPriceChanged,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartCheckedOut,
} from '../shoppingCarts/shoppingCart';
import type { ShoppingCartCheckedOutExternal } from '../shoppingCarts/external/shoppingCartExternalEvent';
import { at, cartId, customerId, pricedProductItem } from './fixtures';
import { messageContract } from './messageContract';

export const pricedProductItemSchema = z.object({
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});

export const productItemAdded = messageContract<
  ProductItemAddedToShoppingCart['data']
>({
  type: 'shopping_carts.ProductItemAddedToShoppingCart',
  kind: 'event',
  description: 'A product was added to the shopping cart.',
  schema: z.object({
    shoppingCartId: z.string(),
    customerId: z.string(),
    productItem: pricedProductItemSchema,
    addedAt: z.string(),
  }),
  allFields: {
    shoppingCartId: cartId,
    customerId,
    productItem: pricedProductItem,
    addedAt: at,
  },
});

export const productItemRemoved = messageContract<
  ProductItemRemovedFromShoppingCart['data']
>({
  type: 'shopping_carts.ProductItemRemovedFromShoppingCart',
  kind: 'event',
  description: 'A product was removed from the shopping cart.',
  schema: z.object({
    shoppingCartId: z.string(),
    productItem: pricedProductItemSchema,
    removedAt: z.string(),
  }),
  allFields: {
    shoppingCartId: cartId,
    productItem: pricedProductItem,
    removedAt: at,
  },
});

export const productItemPriceChanged = messageContract<
  ProductItemPriceChanged['data']
>({
  type: 'shopping_carts.ProductItemPriceChanged',
  kind: 'event',
  description: 'The price of a product in the cart changed at checkout.',
  schema: z.object({
    shoppingCartId: z.string(),
    productId: z.string(),
    oldUnitPrice: z.number(),
    newUnitPrice: z.number(),
    changedAt: z.string(),
  }),
  allFields: {
    shoppingCartId: cartId,
    productId: 'product-1',
    oldUnitPrice: 19.99,
    newUnitPrice: 21.5,
    changedAt: at,
  },
});

export const shoppingCartCheckedOut = messageContract<
  ShoppingCartCheckedOut['data']
>({
  type: 'shopping_carts.ShoppingCartCheckedOut',
  kind: 'event',
  description: 'The shopping cart was checked out.',
  schema: z.object({ shoppingCartId: z.string(), checkedOutAt: z.string() }),
  allFields: { shoppingCartId: cartId, checkedOutAt: at },
});

export const shoppingCartCheckedOutExternal = messageContract<
  ShoppingCartCheckedOutExternal['data']
>({
  type: 'shopping_carts.external.ShoppingCartCheckedOut',
  kind: 'event',
  description:
    'A customer checked out a shopping cart. Orders places an order from it.',
  schema: z.object({
    cartId: z.string(),
    customerId: z.string(),
    productItems: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    checkedOutAt: z.string(),
  }),
  allFields: {
    cartId,
    customerId,
    productItems: [pricedProductItem],
    totalPrice: 39.98,
    checkedOutAt: at,
  },
});

export const shoppingCartStoredContracts = [
  productItemAdded,
  productItemRemoved,
  productItemPriceChanged,
  shoppingCartCheckedOut,
];
