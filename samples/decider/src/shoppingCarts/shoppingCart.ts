//////////////////////////////////////
/// Shopping Carts
//////////////////////////////////////

import {
  addProductItem,
  assertProductItemExists,
  ProductItem,
  removeProductItem,
} from './productItem';
import { Decider } from '#core/decider';

//////////////////////////////////////
/// Events
//////////////////////////////////////

export type ShoppingCartEvent =
  | {
      type: 'ShoppingCartOpened';
      data: {
        shoppingCartId: string;
        clientId: string;
        openedAt: string;
      };
    }
  | {
      type: 'ProductItemAddedToShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: ProductItem;
      };
    }
  | {
      type: 'ProductItemRemovedFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: ProductItem;
      };
    }
  | {
      type: 'ShoppingCartConfirmed';
      data: {
        shoppingCartId: string;
        confirmedAt: string;
      };
    }
  | {
      type: 'ShoppingCartCanceled';
      data: {
        shoppingCartId: string;
        canceledAt: string;
      };
    };

//////////////////////////////////////
/// Entity/State
//////////////////////////////////////

export type ShoppingCart =
  | {
      status: 'Empty';
    }
  | {
      status: 'Pending';
      id: string;
      clientId: string;
      productItems: ProductItem[];
    }
  | {
      status: 'Confirmed';
      id: string;
      clientId: string;
      productItems: ProductItem[];
      confirmedAt: Date;
    }
  | {
      status: 'Canceled';
      id: string;
      clientId: string;
      productItems: ProductItem[];
      canceledAt: Date;
    };

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

export const evolve = (
  currentState: ShoppingCart,
  event: ShoppingCartEvent
): ShoppingCart => {
  switch (event.type) {
    case 'ShoppingCartOpened':
      if (currentState.status != 'Empty') return currentState;

      return {
        id: event.data.shoppingCartId,
        clientId: event.data.clientId,
        productItems: [],
        status: 'Pending',
      };
    case 'ProductItemAddedToShoppingCart':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        productItems: addProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case 'ProductItemRemovedFromShoppingCart':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        productItems: removeProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case 'ShoppingCartConfirmed':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        status: 'Confirmed',
        confirmedAt: new Date(event.data.confirmedAt),
      };
    case 'ShoppingCartCanceled':
      if (currentState.status != 'Pending') return currentState;

      return {
        ...currentState,
        status: 'Canceled',
        canceledAt: new Date(event.data.canceledAt),
      };
    default: {
      const _: never = event;
      return currentState;
    }
  }
};

//////////////////////////////////////
/// Commands
//////////////////////////////////////

export type ShoppingCartCommand =
  | {
      type: 'OpenShoppingCart';
      data: {
        shoppingCartId: string;
        clientId: string;
      };
    }
  | {
      type: 'AddProductItemToShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: ProductItem;
      };
    }
  | {
      type: 'RemoveProductItemFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: ProductItem;
      };
    }
  | {
      type: 'ConfirmShoppingCart';
      data: {
        shoppingCartId: string;
      };
    }
  | {
      type: 'CancelShoppingCart';
      data: {
        shoppingCartId: string;
      };
    };

//////////////////////////////////////
/// Decide
//////////////////////////////////////

const decide = (
  { type, data: command }: ShoppingCartCommand,
  shoppingCart: ShoppingCart
): ShoppingCartEvent | ShoppingCartEvent[] => {
  switch (type) {
    case 'OpenShoppingCart': {
      if (shoppingCart.status != 'Empty') {
        throw ShoppingCartErrors.CART_ALREADY_EXISTS;
      }
      return {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId: command.shoppingCartId,
          clientId: command.clientId,
          openedAt: new Date().toJSON(),
        },
      };
    }

    case 'AddProductItemToShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }
      return {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId: command.shoppingCartId,
          productItem: command.productItem,
        },
      };
    }

    case 'RemoveProductItemFromShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      assertProductItemExists(shoppingCart.productItems, command.productItem);

      return {
        type: 'ProductItemRemovedFromShoppingCart',
        data: {
          shoppingCartId: command.shoppingCartId,
          productItem: command.productItem,
        },
      };
    }

    case 'ConfirmShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      return {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId: command.shoppingCartId,
          confirmedAt: new Date().toJSON(),
        },
      };
    }

    case 'CancelShoppingCart': {
      if (shoppingCart.status !== 'Pending') {
        throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
      }

      return {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId: command.shoppingCartId,
          canceledAt: new Date().toJSON(),
        },
      };
    }
    default: {
      const _: never = command;
      throw ShoppingCartErrors.UNKNOWN_COMMAND_TYPE;
    }
  }
};

export const decider: Decider<
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent
> = {
  decide,
  evolve,
  getInitialState: () => {
    return {
      status: 'Empty',
    };
  },
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
  CART_ALREADY_EXISTS = 'CART_ALREADY_EXISTS',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}

export const toShoppingCartStreamId = (shoppingCartId: string) =>
  `shopping_cart-${shoppingCartId}`;
