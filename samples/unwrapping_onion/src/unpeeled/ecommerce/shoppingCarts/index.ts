import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/common/productItem';
import {
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartOpened,
} from './events';

export class ShoppingCart {
  public constructor(
    public id: string,
    public status: string,
    public productItems: Map<string, number>,
    public revision: number
  ) {}

  public static open(id: string, customerId: string): ShoppingCartOpened {
    return {
      type: 'shopping-cart-opened',
      data: {
        shoppingCartId: id,
        customerId,
        openedAt: new Date(),
      },
    };
  }

  public addProductItem(
    newProductItem: ProductItem
  ): ProductItemAddedToShoppingCart {
    if (this.status !== ShoppingCartStatus.Opened) {
      throw Error('Cannot add product to not opened shopping cart');
    }

    return {
      type: 'product-item-added-to-shopping-cart',
      data: {
        shoppingCartId: this.id,
        productItem: newProductItem,
        addedAt: new Date(),
      },
    };
  }

  public removeProductItem(
    productItemToRemove: ProductItem
  ): ProductItemRemovedFromShoppingCart {
    if (this.status !== ShoppingCartStatus.Opened) {
      throw Error('Cannot remove product from not opened shopping cart');
    }

    const { productId, quantity } = productItemToRemove;

    const currentQuantity = this.productItems.get(productId);

    const newQuantity = (currentQuantity ?? 0) - quantity;

    if (newQuantity < 0) throw new Error('Product Item not found');

    return {
      type: 'product-item-removed-from-shopping-cart',
      data: {
        shoppingCartId: this.id,
        productItem: productItemToRemove,
        removedAt: new Date(),
      },
    };
  }

  public confirm(): ShoppingCartConfirmed {
    if (this.status !== ShoppingCartStatus.Opened) {
      throw Error('Cannot confirm to not opened shopping cart');
    }
    return {
      type: 'shopping-cart-confirmed',
      data: {
        shoppingCartId: this.id,
        confirmedAt: new Date(),
      },
    };
  }
}

export const ShoppingCartStatus = {
  Opened: 'Opened',
  Confirmed: 'Confirmed',
};
