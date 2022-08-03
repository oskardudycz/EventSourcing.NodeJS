//////////////////////////////////////
/// Shopping Carts
//////////////////////////////////////

import {
  addProductItem,
  assertProductItemExists,
  ProductItem,
  removeProductItem,
} from './productItem';
import { Event } from '#core/event';
import { Decider } from '#core/decider';

//////////////////////////////////////
/// Events
//////////////////////////////////////

export enum ShoppingCartEventType {
  Opened = 'shopping-cart-opened',
  ProductItemAdded = 'product-item-added-to-shopping-cart',
  ProductItemRemoved = 'product-item-removed-from-shopping-cart',
  Confirmed = 'shopping-cart-confirmed',
  Canceled = 'shopping-cart-canceled',
}

export type ShoppingCartOpened = Event<
  ShoppingCartEventType.Opened,
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: string;
  }
>;

export type ProductItemAddedToShoppingCart = Event<
  ShoppingCartEventType.ProductItemAdded,
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export type ProductItemRemovedFromShoppingCart = Event<
  ShoppingCartEventType.ProductItemRemoved,
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export type ShoppingCartConfirmed = Event<
  ShoppingCartEventType.Confirmed,
  {
    shoppingCartId: string;
    confirmedAt: string;
  }
>;

export type ShoppingCartCanceled = Event<
  ShoppingCartEventType.Canceled,
  {
    shoppingCartId: string;
    canceledAt: string;
  }
>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed
  | ShoppingCartCanceled;

//////////////////////////////////////
/// Entity/State
//////////////////////////////////////

export enum ShoppingCartStatus {
  Empty = 'Empty',
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type EmptyShoppingCart = {
  status: ShoppingCartStatus.Empty;
};

export interface PendingShoppingCart {
  id: string;
  clientId: string;
  productItems: ProductItem[];
  status: ShoppingCartStatus.Pending;
}

export interface ConfirmedShoppingCart {
  id: string;
  clientId: string;
  productItems: ProductItem[];
  confirmedAt: Date;
  status: ShoppingCartStatus.Confirmed;
}

export interface CancelledShoppingCart {
  id: string;
  clientId: string;
  productItems: ProductItem[];
  canceledAt: Date;
  status: ShoppingCartStatus.Canceled;
}

export type ShoppingCart =
  | EmptyShoppingCart
  | PendingShoppingCart
  | ConfirmedShoppingCart
  | CancelledShoppingCart;

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

export const evolve = (
  currentState: ShoppingCart,
  event: ShoppingCartEvent
): ShoppingCart => {
  switch (event.type) {
    case ShoppingCartEventType.Opened:
      if (currentState.status != ShoppingCartStatus.Empty) return currentState;

      return {
        id: event.data.shoppingCartId,
        clientId: event.data.clientId,
        productItems: [],
        status: ShoppingCartStatus.Pending,
      };
    case ShoppingCartEventType.ProductItemAdded:
      if (currentState.status != ShoppingCartStatus.Pending)
        return currentState;

      return {
        ...currentState,
        productItems: addProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case ShoppingCartEventType.ProductItemRemoved:
      if (currentState.status != ShoppingCartStatus.Pending)
        return currentState;

      return {
        ...currentState,
        productItems: removeProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case ShoppingCartEventType.Confirmed:
      if (currentState.status != ShoppingCartStatus.Pending)
        return currentState;

      return {
        ...currentState,
        status: ShoppingCartStatus.Confirmed,
        confirmedAt: new Date(event.data.confirmedAt),
      };
    case ShoppingCartEventType.Canceled:
      if (currentState.status != ShoppingCartStatus.Pending)
        return currentState;

      return {
        ...currentState,
        status: ShoppingCartStatus.Canceled,
        canceledAt: new Date(event.data.canceledAt),
      };
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
};

//////////////////////////////////////
/// Commands
//////////////////////////////////////

export type OpenShoppingCart = {
  shoppingCartId: string;
  clientId: string;
};

export type AddProductItemToShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

export type RemoveProductItemFromShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

export type ConfirmShoppingCart = {
  shoppingCartId: string;
};

export type CancelShoppingCart = {
  shoppingCartId: string;
};

export type ShoppingCartCommand =
  | OpenShoppingCart
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart
  | CancelShoppingCart;

//////////////////////////////////////
/// Open shopping cart
//////////////////////////////////////

export const openShoppingCart = ({
  shoppingCartId,
  clientId,
}: OpenShoppingCart): ShoppingCartOpened => {
  return {
    type: ShoppingCartEventType.Opened,
    data: {
      shoppingCartId,
      clientId,
      openedAt: new Date().toJSON(),
    },
  };
};

//////////////////////////////////////
/// Add product item to shopping cart
//////////////////////////////////////

export const addProductItemToShoppingCart = (
  shoppingCart: ShoppingCart,
  { shoppingCartId, productItem }: AddProductItemToShoppingCart
): ProductItemAddedToShoppingCart => {
  if (!isPending(shoppingCart)) {
    throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
  }

  return {
    type: ShoppingCartEventType.ProductItemAdded,
    data: {
      shoppingCartId,
      productItem,
    },
  };
};

//////////////////////////////////////
/// Remove product item to shopping cart
//////////////////////////////////////

export const removeProductItemFromShoppingCart = (
  shoppingCart: ShoppingCart,
  { shoppingCartId, productItem }: RemoveProductItemFromShoppingCart
): ProductItemRemovedFromShoppingCart => {
  if (!isPending(shoppingCart)) {
    throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
  }

  assertProductItemExists(shoppingCart.productItems, productItem);

  return {
    type: ShoppingCartEventType.ProductItemRemoved,
    data: {
      shoppingCartId,
      productItem,
    },
  };
};

//////////////////////////////////////
/// Confirm shopping cart
//////////////////////////////////////

export const confirmShoppingCart = (
  shoppingCart: ShoppingCart,
  { shoppingCartId }: ConfirmShoppingCart
): ShoppingCartConfirmed => {
  if (!isPending(shoppingCart)) {
    throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
  }

  return {
    type: ShoppingCartEventType.Confirmed,
    data: {
      shoppingCartId,
      confirmedAt: new Date().toJSON(),
    },
  };
};

//////////////////////////////////////
/// Cancel shopping cart
//////////////////////////////////////

export const cancelShoppingCart = (
  shoppingCart: ShoppingCart,
  { shoppingCartId }: CancelShoppingCart
): ShoppingCartCanceled => {
  if (!isPending(shoppingCart)) {
    throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
  }

  return {
    type: ShoppingCartEventType.Canceled,
    data: {
      shoppingCartId,
      canceledAt: new Date().toJSON(),
    },
  };
};

const decide = (command: ShoppingCartCommand, state: ShoppingCart) => {
  switch (command) {
  }
};

export const decider: Decider<
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent
> = {
  decide = evolve,
};

//////////////////////////////////////
/// Helpers
//////////////////////////////////////

export const isCashierShoppingCartEvent = (
  event: any
): event is ShoppingCartEvent => {
  return (
    event != null &&
    (event.type === 'shopping-cart-opened' ||
      event.type === 'product-item-added-to-shopping-cart' ||
      event.type === 'product-item-removed-from-shopping-cart' ||
      event.type === 'shopping-cart-confirmed')
  );
};

export const enum ShoppingCartErrors {
  OPENED_EXISTING_CART = 'OPENED_EXISTING_CART',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  CART_NOT_FOUND = 'CART_NOT_FOUND',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
}

export const toShoppingCartStreamName = (shoppingCartId: string) =>
  `shopping_cart-${shoppingCartId}`;

export const isPending = (
  shoppingCart: ShoppingCart
): shoppingCart is PendingShoppingCart => {
  return (
    shoppingCart.status !== ShoppingCartStatus.Confirmed &&
    shoppingCart.status !== ShoppingCartStatus.Canceled
  );
};
