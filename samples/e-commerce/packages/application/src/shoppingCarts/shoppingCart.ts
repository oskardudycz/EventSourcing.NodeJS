import type { Command, Event } from '@event-driven-io/emmett';
import { Urns } from '@e-commerce/core';
import {
  ProductItems,
  type PricedProductItem,
  type ProductItem,
} from './productItems';

const cartType = 'cart';
const namespace = 'ecommerce';

export const ShoppingCartId = {
  of: (customerId: string, cartNumber: number): string =>
    Urns.of(namespace, cartType, `${customerId}-${cartNumber}`),
  require: (id: string): string => Urns.requireType(id, cartType),
  tailOf: Urns.tailOf,
  streamNameOf: (id: string): string =>
    `shopping_carts_cart-${Urns.tailOf(id)}`,
};

export type ShoppingCartStatus = 'Pending' | 'CheckedOut';

export type ProductItemAddedToShoppingCart = Event<
  'shopping_carts.ProductItemAddedToShoppingCart',
  {
    shoppingCartId: string;
    customerId: string;
    productItem: PricedProductItem;
    addedAt: string;
  }
>;

export type ProductItemRemovedFromShoppingCart = Event<
  'shopping_carts.ProductItemRemovedFromShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
    removedAt: string;
  }
>;

export type ProductItemPriceChanged = Event<
  'shopping_carts.ProductItemPriceChanged',
  {
    shoppingCartId: string;
    productId: string;
    oldUnitPrice: number;
    newUnitPrice: number;
    changedAt: string;
  }
>;

export type ShoppingCartCheckedOut = Event<
  'shopping_carts.ShoppingCartCheckedOut',
  { shoppingCartId: string; checkedOutAt: string }
>;

export type ShoppingCartEvent =
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ProductItemPriceChanged
  | ShoppingCartCheckedOut;

export type AddProductItemToShoppingCart = Command<
  'shopping_carts.AddProductItemToShoppingCart',
  {
    shoppingCartId: string;
    customerId: string;
    productItem: ProductItem;
    currentUnitPrice: number;
    now: string;
  }
>;

export type RemoveProductItemFromShoppingCart = Command<
  'shopping_carts.RemoveProductItemFromShoppingCart',
  { shoppingCartId: string; productItem: ProductItem; now: string }
>;

export type CheckOutShoppingCart = Command<
  'shopping_carts.CheckOutShoppingCart',
  {
    shoppingCartId: string;
    currentUnitPrices: Record<string, number>;
    now: string;
  }
>;

export type ShoppingCartCommand =
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | CheckOutShoppingCart;

export const shoppingCartCommandTypes: ShoppingCartCommand['type'][] = [
  'shopping_carts.AddProductItemToShoppingCart',
  'shopping_carts.RemoveProductItemFromShoppingCart',
  'shopping_carts.CheckOutShoppingCart',
];

export type ShoppingCart = {
  id?: string;
  productItems: PricedProductItem[];
  status?: ShoppingCartStatus;
};

export const initialShoppingCart = (): ShoppingCart => ({ productItems: [] });

export const isCheckedOut = (state: ShoppingCart) =>
  state.status === 'CheckedOut';

export const isClosed = (state: ShoppingCart) =>
  state.status === undefined || state.status === 'CheckedOut';

export const evolve = (
  state: ShoppingCart,
  event: ShoppingCartEvent,
): ShoppingCart => {
  switch (event.type) {
    case 'shopping_carts.ProductItemAddedToShoppingCart':
      return {
        id: state.status === undefined ? event.data.shoppingCartId : state.id,
        productItems: ProductItems.add(
          state.productItems,
          event.data.productItem,
        ),
        status: state.status ?? 'Pending',
      };
    case 'shopping_carts.ProductItemRemovedFromShoppingCart':
      return {
        ...state,
        productItems: ProductItems.remove(
          state.productItems,
          event.data.productItem,
        ),
      };
    case 'shopping_carts.ProductItemPriceChanged':
      return {
        ...state,
        productItems: ProductItems.changeUnitPrice(
          state.productItems,
          event.data.productId,
          event.data.newUnitPrice,
        ),
      };
    case 'shopping_carts.ShoppingCartCheckedOut':
      return { ...state, status: 'CheckedOut' };
  }
};
