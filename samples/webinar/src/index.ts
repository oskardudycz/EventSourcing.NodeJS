//////////////////////////////////////
/// Events
//////////////////////////////////////

export type ShoppingCartOpened = {
  shoppingCartId: string;
  clientId: string;
  openedAt: Date;
};

export type ProductItemAddedToShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

export type ProductItem = {
  productId: string;
  quantity: number;
};

export type ProductItemRemovedFromShoppingCart = {
  shoppingCartId: string;
  productItem: ProductItem;
};

export type ShoppingCartConfirmed = {
  shoppingCartId: string;
  confirmedAt: Date;
};

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;
