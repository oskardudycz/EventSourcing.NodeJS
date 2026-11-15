//////////////////////////////////////
/// Shopping Carts
//////////////////////////////////////

import type { Command, Event } from '@event-driven-io/emmett';
import { IllegalStateError, ValidationError } from '@event-driven-io/emmett';
import type { PricedProductItem, ProductItem } from './productItem';
import {
  addProductItem,
  assertProductItemExists,
  removeProductItem,
} from './productItem';
import type { User } from './user';

//////////////////////////////////////
/// Events
//////////////////////////////////////

export type ShoppingCartOpened = Event<
  'shopping-cart-opened',
  {
    shoppingCartId: string;
    openedAt: string;
  }
>;

export type ProductItemAddedToShoppingCart = Event<
  'product-item-added-to-shopping-cart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
    addedAt: string;
  }
>;

export type ProductItemRemovedFromShoppingCart = Event<
  'product-item-removed-from-shopping-cart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
    removedAt: string;
  }
>;

export type ShoppingCartConfirmed = Event<
  'shopping-cart-confirmed',
  {
    shoppingCartId: string;
    user: User;

    additionalInfo: {
      content?: string;
      line1?: string;
      line2?: string;
    };
    confirmedAt: string;
  }
>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;

//////////////////////////////////////
/// Entity/State
//////////////////////////////////////

export const enum ShoppingCartStatus {
  Opened = 1,
  Confirmed = 2,
  Cancelled = 4,
  Closed = Confirmed | Cancelled,
}

export interface ShoppingCart {
  id: string;
  status: ShoppingCartStatus;
  productItems: PricedProductItem[];
}

export const enum ShoppingCartErrors {
  OPENED_EXISTING_CART = 'OPENED_EXISTING_CART',
  CART_IS_NOT_OPENED = 'CART_IS_NOT_OPENED',
  USER_DOES_NOT_EXISTS = 'USER_DOES_NOT_EXISTS',
  NO_PRODUCTS_ITEMS = 'NO_PRODUCTS_ITEMS',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
}

export const toShoppingCartStreamName = (shoppingCartId: string) =>
  `shopping_cart-${shoppingCartId}`;

export const assertShoppingCartIsOpened = (shoppingCart: ShoppingCart) => {
  if (shoppingCart.status !== ShoppingCartStatus.Opened) {
    throw new IllegalStateError(ShoppingCartErrors.CART_IS_NOT_OPENED);
  }
};

export const assertHasProductItems = (shoppingCart: ShoppingCart) => {
  if (shoppingCart.productItems.length === 0) {
    throw new IllegalStateError(ShoppingCartErrors.NO_PRODUCTS_ITEMS);
  }
};

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

export const initialState = (): ShoppingCart => ({}) as ShoppingCart;

export const evolve = (
  currentState: ShoppingCart,
  event: ShoppingCartEvent,
): ShoppingCart => {
  switch (event.type) {
    case 'shopping-cart-opened':
      return {
        id: event.data.shoppingCartId,
        productItems: [],
        status: ShoppingCartStatus.Opened,
      };
    case 'product-item-added-to-shopping-cart':
      return {
        ...currentState,
        productItems: addProductItem(
          currentState.productItems,
          event.data.productItem,
        ),
      };
    case 'product-item-removed-from-shopping-cart':
      return {
        ...currentState,
        productItems: removeProductItem(
          currentState.productItems,
          event.data.productItem,
        ),
      };
    case 'shopping-cart-confirmed':
      return {
        ...currentState,
        status: ShoppingCartStatus.Confirmed,
      };
    default: {
      const _: never = event;
      console.error(`Unknown event type %s`, event);
      return currentState;
    }
  }
};

//////////////////////////////////////
/// Open shopping cart
//////////////////////////////////////

export type OpenShoppingCart = Command<
  'OpenShoppingCart',
  {
    shoppingCartId: string;
  },
  { now: Date }
>;

export const openShoppingCart = ({
  data: { shoppingCartId },
  metadata,
}: OpenShoppingCart): ShoppingCartOpened => {
  return {
    type: 'shopping-cart-opened',
    data: {
      shoppingCartId,
      openedAt: metadata.now.toJSON(),
    },
  };
};

//////////////////////////////////////
/// Add product item to shopping cart
//////////////////////////////////////

export type AddProductItemToShoppingCart = Command<
  'AddProductItemToShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
  },
  { now: Date }
>;

export const addProductItemToShoppingCart = (
  {
    data: { shoppingCartId, productItem },
    metadata,
  }: AddProductItemToShoppingCart,
  shoppingCart: ShoppingCart,
): ProductItemAddedToShoppingCart => {
  assertShoppingCartIsOpened(shoppingCart);

  return {
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId,
      productItem,
      addedAt: metadata.now.toJSON(),
    },
  };
};

//////////////////////////////////////
/// Remove product item to shopping cart
//////////////////////////////////////

export type RemoveProductItemFromShoppingCart = Command<
  'RemoveProductItemFromShoppingCart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  },
  { now: Date }
>;

export const removeProductItemFromShoppingCart = (
  {
    data: { shoppingCartId, productItem },
    metadata,
  }: RemoveProductItemFromShoppingCart,
  shoppingCart: ShoppingCart,
): ProductItemRemovedFromShoppingCart => {
  assertShoppingCartIsOpened(shoppingCart);

  const current = assertProductItemExists(
    shoppingCart.productItems,
    productItem,
  );

  return {
    type: 'product-item-removed-from-shopping-cart',
    data: {
      shoppingCartId,
      productItem: { ...current, quantity: productItem.quantity },
      removedAt: metadata.now.toJSON(),
    },
  };
};

//////////////////////////////////////
/// Confirm shopping cart
//////////////////////////////////////

export type ConfirmShoppingCart = Command<
  'ConfirmShoppingCart',
  {
    shoppingCartId: string;
    user: User;
    additionalInfo: {
      content?: string;
      line1?: string;
      line2?: string;
    };
  },
  { now: Date }
>;

export const confirmShoppingCart = (
  {
    data: { shoppingCartId, user, additionalInfo },
    metadata,
  }: ConfirmShoppingCart,
  shoppingCart: ShoppingCart,
): ShoppingCartConfirmed => {
  assertShoppingCartIsOpened(shoppingCart);
  assertHasProductItems(shoppingCart);

  return {
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId,
      user,
      additionalInfo,
      confirmedAt: metadata.now.toJSON(),
    },
  };
};

//////////////////////////////////////
/// Decider
//////////////////////////////////////

export type ShoppingCartCommand =
  | OpenShoppingCart
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart;

export const decide = (
  command: ShoppingCartCommand,
  shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  const { type } = command;

  switch (type) {
    case 'OpenShoppingCart':
      return openShoppingCart(command);
    case 'AddProductItemToShoppingCart':
      return addProductItemToShoppingCart(command, shoppingCart);
    case 'RemoveProductItemFromShoppingCart':
      return removeProductItemFromShoppingCart(command, shoppingCart);
    case 'ConfirmShoppingCart':
      return confirmShoppingCart(command, shoppingCart);
    default: {
      const _: never = command;
      throw new ValidationError(`Unknown command type: ${type as string}`);
    }
  }
};

export const decider = { decide, evolve, initialState };
