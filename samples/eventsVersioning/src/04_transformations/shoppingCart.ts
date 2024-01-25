import { Event } from '#core/event';
import { merge } from '#core/utils';
import { PricedProductItem } from '../events/events.v1';

export type Client = {
  id: string;
  name: string;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened.v2',
  {
    shoppingCartId: string;
    //new nested property instead of a single field
    client: Client;
  }
>;

export enum ShoppingCartStatus {
  Pending = 'Pending',
  Opened = 'Opened',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCartOpenedWithStatus = Event<
  'ShoppingCartOpened.v3',
  {
    shoppingCartId: string;
    client: Client;
    // Adding new required property as nullable
    status: ShoppingCartStatus;
  }
>;

export type ShoppingCartEvent =
  | ShoppingCartOpenedWithStatus
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

export type ShoppingCart = Readonly<{
  id: string;
  client: Client;
  status: ShoppingCartStatus;
  productItems: PricedProductItem[];
  confirmedAt?: Date;
  canceledAt?: Date;
}>;

export const evolve = (
  state: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened.v3':
      return {
        id: event.shoppingCartId,
        client: event.client,
        productItems: [],
        status: event.status,
      };
    case 'ProductItemAddedToShoppingCart': {
      const { productItems } = state;
      const { productItem } = event;

      return {
        ...state,
        productItems: merge(
          productItems,
          productItem,
          (p) =>
            p.productId === productItem.productId &&
            p.unitPrice === productItem.unitPrice,
          (p) => {
            return {
              ...p,
              quantity: p.quantity + productItem.quantity,
            };
          },
          () => productItem,
        ),
      };
    }
    case 'ProductItemRemovedFromShoppingCart': {
      const { productItems } = state;
      const { productItem } = event;
      return {
        ...state,
        productItems: merge(
          productItems,
          productItem,
          (p) =>
            p.productId === productItem.productId &&
            p.unitPrice === productItem.unitPrice,
          (p) => {
            return {
              ...p,
              quantity: p.quantity - productItem.quantity,
            };
          },
        ),
      };
    }
    case 'ShoppingCartConfirmed':
      return {
        ...state,
        status: ShoppingCartStatus.Confirmed,
        confirmedAt: new Date(event.confirmedAt),
      };
    case 'ShoppingCartCanceled':
      return {
        ...state,
        status: ShoppingCartStatus.Canceled,
        canceledAt: new Date(event.canceledAt),
      };
  }
};
