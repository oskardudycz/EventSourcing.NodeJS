import { merge } from '../../tools/utils';

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type ShoppingCartEvent =
  | {
      type: 'ShoppingCartOpened';
      data: {
        shoppingCartId: string;
        clientId: string;
        openedAt: Date;
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
        confirmedAt: Date;
      };
    }
  | {
      type: 'ShoppingCartCanceled';
      data: {
        shoppingCartId: string;
        canceledAt: Date;
      };
    };

export enum ShoppingCartStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCart = Readonly<{
  id: string;
  clientId: string;
  status: ShoppingCartStatus;
  productItems: PricedProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
  canceledAt?: Date;
}>;

export const evolve = (
  state: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened':
      return {
        id: event.shoppingCartId,
        clientId: event.clientId,
        openedAt: event.openedAt,
        productItems: [],
        status: ShoppingCartStatus.Pending,
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
        confirmedAt: event.confirmedAt,
      };
    case 'ShoppingCartCanceled':
      return {
        ...state,
        status: ShoppingCartStatus.Canceled,
        canceledAt: event.canceledAt,
      };
  }
};
