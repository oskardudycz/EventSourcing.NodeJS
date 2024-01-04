//////////////////////////////////////
/// Shopping Carts
//////////////////////////////////////

import {
  addProductItem,
  assertProductItemExists,
  PricedProductItem,
  ProductItems,
  removeProductItem,
} from './productItem';
import { Map } from 'immutable';
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
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ProductItemRemovedFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
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
      productItems: ProductItems;
    }
  | {
      status: 'Closed';
    };

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

export const evolve = (
  cart: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened':
      if (cart.status != 'Empty') return cart;

      return {
        productItems: Map<string, Map<number, number>>(),
        status: 'Pending',
      };
    case 'ProductItemAddedToShoppingCart':
      if (cart.status != 'Pending') return cart;

      return {
        ...cart,
        productItems: addProductItem(cart.productItems, event.productItem),
      };
    case 'ProductItemRemovedFromShoppingCart':
      if (cart.status != 'Pending') return cart;

      return {
        ...cart,
        productItems: removeProductItem(cart.productItems, event.productItem),
      };
    case 'ShoppingCartConfirmed':
      if (cart.status != 'Pending') return cart;

      return {
        status: 'Closed',
      };
    case 'ShoppingCartCanceled':
      if (cart.status != 'Pending') return cart;

      return {
        status: 'Closed',
      };
    default: {
      const _: never = type;
      return cart;
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
        now: Date;
      };
    }
  | {
      type: 'AddProductItemToShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'RemoveProductItemFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ConfirmShoppingCart';
      data: {
        shoppingCartId: string;
        now: Date;
      };
    }
  | {
      type: 'CancelShoppingCart';
      data: {
        shoppingCartId: string;
        now: Date;
      };
    };

//////////////////////////////////////
/// Decide
//////////////////////////////////////

const decide = (
  { type, data: command }: ShoppingCartCommand,
  shoppingCart: ShoppingCart,
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
          openedAt: command.now.toJSON(),
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
          confirmedAt: command.now.toJSON(),
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
          canceledAt: command.now.toJSON(),
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
  initialState: () => {
    return {
      status: 'Empty',
    };
  },
};

//////////////////////////////////////
/// Helpers
//////////////////////////////////////

export const isCashierShoppingCartEvent = (
  event: null | { type: string },
): event is ShoppingCartEvent => {
  return (
    event != null &&
    (event.type === 'ShoppingCartOpened' ||
      event.type === 'ProductItemAddedToShoppingCart' ||
      event.type === 'ProductItemRemovedFromShoppingCart' ||
      event.type === 'ShoppingCartConfirmed' ||
      event.type === 'ShoppingCartCanceled')
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
