//////////////////////////////////////
/// Events
//////////////////////////////////////

export type ShoppingCartOpened = Readonly<{
  shoppingCartId: string;
  clientId: string;
  openedAt: Date;
}>;

export type ProductItemAddedToShoppingCart = Readonly<{
  shoppingCartId: string;
  productItem: ProductItem;
}>;

export type ProductItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export type ProductItemRemovedFromShoppingCart = Readonly<{
  shoppingCartId: string;
  productItem: ProductItem;
}>;

export type ShoppingCartConfirmed = Readonly<{
  shoppingCartId: string;
  confirmedAt: Date;
}>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed;
