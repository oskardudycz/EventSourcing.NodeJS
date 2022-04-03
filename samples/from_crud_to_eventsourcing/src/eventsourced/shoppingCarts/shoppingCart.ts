//////////////////////////////////////
/// Shopping Carts
//////////////////////////////////////

import { StreamAggregator } from '#eventsourced/core/streams';
import {
  JSONEventType,
  ResolvedEvent,
  StreamingRead,
} from '@eventstore/db-client';
import {
  addProductItem,
  assertProductItemExists,
  PricedProductItem,
  ProductItem,
  removeProductItem,
} from './productItem';
import { User } from './user';

//////////////////////////////////////
/// Events
//////////////////////////////////////

export type ShoppingCartOpened = JSONEventType<
  'shopping-cart-opened',
  {
    shoppingCartId: string;
    openedAt: string;
  }
>;

export type ProductItemAddedToShoppingCart = JSONEventType<
  'product-item-added-to-shopping-cart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
    addedAt: string;
  }
>;

export type ProductItemRemovedFromShoppingCart = JSONEventType<
  'product-item-removed-from-shopping-cart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
    removedAt: string;
  }
>;

export type ShoppingCartConfirmed = JSONEventType<
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
  userId?: string;
  status: ShoppingCartStatus;
  productItems: PricedProductItem[];
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
  USER_DOES_NOT_EXISTS = 'USER_DOES_NOT_EXISTS',
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
};

export const openShoppingCart = ({
  shoppingCartId,
}: OpenShoppingCart): ShoppingCartOpened => {
  return {
    type: 'shopping-cart-opened',
    data: {
      shoppingCartId,
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
  getPricedProduct: (productItem: ProductItem) => Promise<PricedProductItem>,
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId, productItem }: AddProductItemToShoppingCart
): Promise<ProductItemAddedToShoppingCart> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  const pricedProductItem = await getPricedProduct(productItem);

  return {
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId,
      productItem: pricedProductItem,
      addedAt: new Date().toJSON(),
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

  const current = assertProductItemExists(
    shoppingCart.productItems,
    productItem
  );

  return {
    type: 'product-item-removed-from-shopping-cart',
    data: {
      shoppingCartId,
      productItem: { ...current, quantity: productItem.quantity },
      removedAt: new Date().toJSON(),
    },
  };
};

//////////////////////////////////////
/// Confirm shopping cart
//////////////////////////////////////

export type ConfirmShoppingCart = {
  shoppingCartId: string;
  userId: number;
  additionalInfo: {
    content?: string;
    line1?: string;
    line2?: string;
  };
};

export const confirmShoppingCart = async (
  getUserData: (userId: number) => Promise<User | undefined>,
  events: StreamingRead<ResolvedEvent<ShoppingCartEvent>>,
  { shoppingCartId, additionalInfo, userId }: ConfirmShoppingCart
): Promise<ShoppingCartConfirmed> => {
  const shoppingCart = await getShoppingCart(events);

  assertShoppingCartIsNotClosed(shoppingCart);

  const user = await getUserData(userId);

  if (!user) {
    throw ShoppingCartErrors.USER_DOES_NOT_EXISTS;
  }

  return {
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId,
      user,
      additionalInfo,
      confirmedAt: new Date().toJSON(),
    },
  };
};
