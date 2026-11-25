import { z } from 'zod';
import type {
  ProductItemAddedToShoppingCart,
  ProductItemPriceChanged,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartCheckedOut,
} from './shoppingCart';
import type { ShoppingCartCheckedOutExternal } from './external/shoppingCartExternalEvent';
import type { Cart } from './getCart/carts';
import type { ProductItem } from './productItems';
import {
  at,
  cartId,
  customerId,
  pricedProductItem,
} from '../documentation/fixtures';
import {
  bodyContract,
  messageContract,
} from '../documentation/messageContract';

export const pricedProductItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int(),
  unitPrice: z.number(),
});

export const productItemSchema = z
  .object({
    productId: z.uuid().describe('Id of the product'),
    quantity: z.number().int().positive().describe('How many to add'),
  })
  .meta({ id: 'ProductItem' });

export const cartSchema = z
  .object({
    shoppingCartId: z.string(),
    customerId: z.uuid(),
    lines: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    checkedOut: z.boolean(),
    version: z.number(),
  })
  .meta({ id: 'Cart' });

export const productItemAdded = messageContract<
  ProductItemAddedToShoppingCart['data']
>({
  type: 'shopping_carts.ProductItemAddedToShoppingCart',
  kind: 'event',
  description: 'A product was added to the shopping cart.',
  schema: z.object({
    shoppingCartId: z.string(),
    customerId: z.uuid(),
    productItem: pricedProductItemSchema,
    addedAt: z.iso.datetime(),
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
    removedAt: z.iso.datetime(),
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
    productId: z.uuid(),
    oldUnitPrice: z.number(),
    newUnitPrice: z.number(),
    changedAt: z.iso.datetime(),
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
  schema: z.object({
    shoppingCartId: z.string(),
    checkedOutAt: z.iso.datetime(),
  }),
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
    customerId: z.uuid(),
    productItems: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    checkedOutAt: z.iso.datetime(),
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

export const shoppingCartBodyContracts = [
  bodyContract<ProductItem>({
    name: 'ProductItem',
    schema: productItemSchema,
    allFields: { productId: 'product-1', quantity: 2 },
  }),
  bodyContract<Cart>({
    name: 'Cart',
    schema: cartSchema,
    allFields: {
      shoppingCartId: cartId,
      customerId,
      lines: [pricedProductItem],
      totalPrice: 39.98,
      checkedOut: false,
      version: 1,
    },
  }),
];
