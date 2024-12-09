import { PricedProductItem } from './shoppingCart';

export type OpenShoppingCart = {
  type: 'OpenShoppingCart';
  data: {
    shoppingCartId: string;
    clientId: string;
    now: Date;
  };
};

export type AddProductItemToShoppingCart = {
  type: 'AddProductItemToShoppingCart';
  data: {
    shoppingCartId: string;
    productItem: PricedProductItem;
  };
};

export type RemoveProductItemFromShoppingCart = {
  type: 'RemoveProductItemFromShoppingCart';
  data: {
    shoppingCartId: string;
    productItem: PricedProductItem;
  };
};

export type ConfirmShoppingCart = {
  type: 'ConfirmShoppingCart';
  data: {
    shoppingCartId: string;
    now: Date;
  };
};

export type CancelShoppingCart = {
  type: 'CancelShoppingCart';
  data: {
    shoppingCartId: string;
    now: Date;
  };
};

export type ShoppingCartCommand =
  | OpenShoppingCart
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart
  | CancelShoppingCart;

export const enum ShoppingCartErrors {
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  CART_IS_EMPTY = 'CART_IS_EMPTY',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}
