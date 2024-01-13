import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartStatus,
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

export const assertProductItemExists = (
  productItems: PricedProductItem[],
  { productId, quantity, unitPrice }: PricedProductItem,
): void => {
  const currentQuantity =
    productItems.find(
      (p) => p.productId === productId && p.unitPrice == unitPrice,
    )?.quantity ?? 0;

  if (currentQuantity < quantity) {
    throw new Error(ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND);
  }
};

export const openShoppingCart = ({
  data: command,
}: OpenShoppingCart): ShoppingCartEvent => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: command.shoppingCartId,
      clientId: command.clientId,
      openedAt: command.now,
    },
  };
};

export const addProductItemToShoppingCart = (
  { data: command }: AddProductItemToShoppingCart,
  shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }
  return {
    type: 'ProductItemAddedToShoppingCart',
    data: {
      shoppingCartId: command.shoppingCartId,
      productItem: command.productItem,
    },
  };
};

export const removeProductItemFromShoppingCart = (
  { data: command }: RemoveProductItemFromShoppingCart,
  shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }

  assertProductItemExists(shoppingCart.productItems, command.productItem);

  return {
    type: 'ProductItemRemovedFromShoppingCart',
    data: {
      shoppingCartId: command.shoppingCartId,
      productItem: command.productItem,
    },
  };
};

export const confirmShoppingCart = (
  { data: command }: ConfirmShoppingCart,
  shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }

  if (shoppingCart.productItems.length === 0) {
    throw new Error(ShoppingCartErrors.CART_IS_EMPTY);
  }

  return {
    type: 'ShoppingCartConfirmed',
    data: {
      shoppingCartId: command.shoppingCartId,
      confirmedAt: command.now,
    },
  };
};

export const cancelShoppingCart = (
  { data: command }: CancelShoppingCart,
  shoppingCart: ShoppingCart,
): ShoppingCartEvent => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }

  return {
    type: 'ShoppingCartCanceled',
    data: {
      shoppingCartId: command.shoppingCartId,
      canceledAt: command.now,
    },
  };
};
