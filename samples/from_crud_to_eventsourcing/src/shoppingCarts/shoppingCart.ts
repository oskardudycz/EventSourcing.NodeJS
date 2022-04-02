//////////////////////////////////////
/// Shopping Carts
//////////////////////////////////////

import {
  JSONEventType,
  ResolvedEvent,
  StreamingRead,
} from '@eventstore/db-client';
import { StreamAggregator } from '#core/streams';
import {
  addProductItem,
  assertProductItemExists,
  ProductItem,
  removeProductItem,
} from './productItem';

//////////////////////////////////////
/// Events
//////////////////////////////////////

export type ShoppingCartOpened = JSONEventType<
  'shopping-cart-opened',
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: string;
  }
>;

export type ProductItemAddedToShoppingCart = JSONEventType<
  'product-item-added-to-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export type ProductItemRemovedFromShoppingCart = JSONEventType<
  'product-item-removed-from-shopping-cart',
  {
    shoppingCartId: string;
    productItem: ProductItem;
  }
>;

export type ShoppingCartConfirmed = JSONEventType<
  'shopping-cart-confirmed',
  {
    shoppingCartId: string;
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
  clientId: string;
  status: ShoppingCartStatus;
  productItems: ProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
}

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

export const assertShoppingCartIsNotClosed = (shoppingCart: ShoppingCart) => {
  if (
    (shoppingCart.status & ShoppingCartStatus.Closed) ===
    ShoppingCartStatus.Closed
  ) {
    throw ShoppingCartErrors.CART_IS_ALREADY_CLOSED;
  }
};

//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

export const getShoppingCart = StreamAggregator<
  ShoppingCart,
  ShoppingCartEvent
>((currentState, event) => {
  if (event.type === 'shopping-cart-opened') {
    if (currentState != null) throw ShoppingCartErrors.OPENED_EXISTING_CART;
    return {
      id: event.data.shoppingCartId,
      clientId: event.data.clientId,
      openedAt: new Date(event.data.openedAt),
      productItems: [],
      status: ShoppingCartStatus.Opened,
    };
  }

  if (currentState == null) throw ShoppingCartErrors.CART_NOT_FOUND;

  switch (event.type) {
    case 'product-item-added-to-shopping-cart':
      return {
        ...currentState,
        productItems: addProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case 'product-item-removed-from-shopping-cart':
      return {
        ...currentState,
        productItems: removeProductItem(
          currentState.productItems,
          event.data.productItem
        ),
      };
    case 'shopping-cart-confirmed':
      return {
        ...currentState,
        status: ShoppingCartStatus.Confirmed,
        confirmedAt: new Date(event.data.confirmedAt),
      };
    default: {
      const _: never = event;
      throw ShoppingCartErrors.UNKNOWN_EVENT_TYPE;
    }
  }
});

//////////////////////////////////////
/// Open shopping cart
//////////////////////////////////////

export type OpenShoppingCart = {
  shoppingCartId: string;
  clientId: string;
};

export const openShoppingCart = ({
  shoppingCartId,
  clientId,
}: OpenShoppingCart): ShoppingCartOpened => {
  return {
    type: 'shopping-cart-opened',
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

export type AddProductItemToShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

export const addProductItemToShoppingCart = async (
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId, productItem }: AddProductItemToShoppingCart
): Promise<ProductItemAddedToShoppingCart> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  return {
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId,
      productItem,
    },
  };
};

//////////////////////////////////////
/// Remove product item to shopping cart
//////////////////////////////////////

export type RemoveProductItemFromShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

export const removeProductItemFromShoppingCart = async (
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId, productItem }: RemoveProductItemFromShoppingCart
): Promise<ProductItemRemovedFromShoppingCart> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  assertProductItemExists(shoppingCart.productItems, productItem);

  return {
    type: 'product-item-removed-from-shopping-cart',
    data: {
      shoppingCartId,
      productItem,
    },
  };
};

//////////////////////////////////////
/// Confirm shopping cart
//////////////////////////////////////

export type ConfirmShoppingCart = {
  shoppingCartId: string;
};

export const confirmShoppingCart = async (
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId }: ConfirmShoppingCart
): Promise<ShoppingCartConfirmed> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  return {
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId,
      confirmedAt: new Date().toJSON(),
    },
  };
};
