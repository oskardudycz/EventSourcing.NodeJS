//////////////////////////////////////////
///        Entities
//////////////////////////////////////////

export type ShoppingCart = Readonly<{
  id: string;
  status: string;
  productItems: Map<string, number>;
  revision: number;
}>;

export const ShoppingCartStatus = {
  Opened: 'Opened',
  Confirmed: 'Confirmed',
};

export type ProductItem = {
  productId: string;
  quantity: number;
};

//////////////////////////////////////////
///        COMMANDS
//////////////////////////////////////////

export type OpenShoppingCart = Readonly<{
  type: 'open-shopping-cart';
  data: {
    shoppingCartId: string;
    customerId: string;
  };
}>;

export type AddProductItemToShoppingCart = Readonly<{
  type: 'add-product-item-to-shopping-cart';
  data: {
    shoppingCartId: string;
    productItem: ProductItem;
  };
}>;

export type RemoveProductItemFromShoppingCart = Readonly<{
  type: 'remove-product-item-from-shopping-cart';
  data: {
    shoppingCartId: string;
    productItem: ProductItem;
  };
}>;

export type ConfirmShoppingCart = Readonly<{
  type: 'confirm-shopping-cart';
  data: {
    shoppingCartId: string;
  };
}>;

export type ShoppingCartCommand =
  | OpenShoppingCart
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart;

//////////////////////////////////////////
///        Events
//////////////////////////////////////////

export type ShoppingCartOpened = Readonly<{
  type: 'shopping-cart-opened';
  data: {
    shoppingCartId: string;
    customerId: string;
    openedAt: Date;
  };
}>;

export type ProductItemAddedToShoppingCart = Readonly<{
  type: 'product-item-added-to-shopping-cart';
  data: {
    shoppingCartId: string;
    productItem: ProductItem;
    addedAt: Date;
  };
}>;

export type ProductItemRemovedFromShoppingCart = Readonly<{
  type: 'product-item-removed-from-shopping-cart';
  data: {
    shoppingCartId: string;
    productItem: ProductItem;
    removedAt: Date;
  };
}>;

export type ShoppingCartConfirmed = Readonly<{
  type: 'shopping-cart-confirmed';
  data: {
    shoppingCartId: string;
    confirmedAt: Date;
  };
}>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;
