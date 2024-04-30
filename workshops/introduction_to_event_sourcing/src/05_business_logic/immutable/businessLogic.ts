import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
} from './shoppingCart';

//////////////////////////////////////
/// Commands
//////////////////////////////////////

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

//////////////////////////////////////
/// Decide
//////////////////////////////////////

export const enum ShoppingCartErrors {
  CART_ALREADY_EXISTS = 'CART_ALREADY_EXISTS',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  CART_IS_EMPTY = 'CART_IS_EMPTY',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}

export const openShoppingCart = ({
  data: _command,
}: OpenShoppingCart): ShoppingCartEvent => {
  throw new Error('Fill the implementation part');
};

export const addProductItemToShoppingCart = (
  { data: _command }: AddProductItemToShoppingCart,
  _shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  throw new Error('Fill the implementation part');
};

export const removeProductItemFromShoppingCart = (
  { data: _command }: RemoveProductItemFromShoppingCart,
  _shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  throw new Error('Fill the implementation part');
};

export const confirmShoppingCart = (
  { data: _command }: ConfirmShoppingCart,
  _shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  throw new Error('Fill the implementation part');
};

export const cancelShoppingCart = (
  { data: _command }: CancelShoppingCart,
  _shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  throw new Error('Fill the implementation part');
};
