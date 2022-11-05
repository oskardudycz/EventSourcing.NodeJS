import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/common/productItem';
import {
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartOpened,
} from './events';

export class ShoppingCart {
  public constructor(
    private _id: string,
    private _customerId: string,
    private _status: string,
    private _productItems: ProductItem[],
    private _openedAt: Date,
    private _confirmedAt: Date | undefined,
    private _revision: number
  ) {}

  public get id() {
    return this._id;
  }

  public get customerId() {
    return this._customerId;
  }

  public get status() {
    return this._status;
  }

  public get productItems() {
    return this._productItems;
  }

  public get openedAt() {
    return this._openedAt;
  }

  public get confirmedAt() {
    return this._confirmedAt;
  }

  public get revision() {
    return this._revision;
  }

  public static open(
    id: string,
    customerId: string
  ): { aggregate: ShoppingCart; event: ShoppingCartOpened } {
    const openedAt = new Date();

    return {
      aggregate: new ShoppingCart(
        id,
        customerId,
        ShoppingCartStatus.Opened,
        [],
        openedAt,
        undefined,
        1
      ),
      event: {
        type: 'shopping-cart-opened',
        data: {
          shoppingCartId: id,
          customerId,
          openedAt: openedAt,
        },
      },
    };
  }

  public addProductItem(
    newProductItem: ProductItem
  ): ProductItemAddedToShoppingCart {
    if (this.status !== ShoppingCartStatus.Opened) {
      throw Error('Cannot add product to not opened shopping cart');
    }

    const { productId, quantity } = newProductItem;

    const currentProductItem = this.findProductItem(
      this._productItems,
      productId
    );

    if (!currentProductItem) {
      this._productItems = [...this._productItems, newProductItem];
    } else {
      const newQuantity = currentProductItem.quantity + quantity;
      const mergedProductItem = { productId, quantity: newQuantity };

      this._productItems = this._productItems.map((pi) =>
        pi.productId === productId ? mergedProductItem : pi
      );
    }

    this._revision++;

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

    const currentProductItem = this.findProductItem(
      this._productItems,
      productId
    );

    const newQuantity = (currentProductItem?.quantity ?? 0) - quantity;

    if (newQuantity < 0) throw 'PRODUCT_ITEM_NOT_FOUND';

    if (newQuantity === 0) {
      this._productItems = this._productItems.filter(
        (pi) => pi.productId !== productId
      );
    } else {
      const mergedProductItem = { productId, quantity: newQuantity };

      this._productItems = this._productItems.map((pi) =>
        pi.productId === productId ? mergedProductItem : pi
      );
    }

    this._revision++;

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
    this._status = ShoppingCartStatus.Confirmed;
    this._confirmedAt = new Date();

    this._revision++;

    return {
      type: 'shopping-cart-confirmed',
      data: {
        shoppingCartId: this.id,
        confirmedAt: this._confirmedAt,
      },
    };
  }

  private findProductItem(
    productItems: ProductItem[],
    productId: string
  ): ProductItem | undefined {
    return productItems.find((pi) => pi.productId === productId);
  }
}

export const ShoppingCartStatus = {
  Opened: 'Opened',
  Confirmed: 'Confirmed',
};
