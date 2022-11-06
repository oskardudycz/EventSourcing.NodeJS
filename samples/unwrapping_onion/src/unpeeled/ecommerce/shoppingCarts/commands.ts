import { ProductItem } from '../../../onion/ecommerce/common/shoppingCarts/productItem';

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
