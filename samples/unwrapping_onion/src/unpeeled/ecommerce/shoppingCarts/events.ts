import { ProductItem } from '../../../onion/ecommerce/common/shoppingCarts/productItem';

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
