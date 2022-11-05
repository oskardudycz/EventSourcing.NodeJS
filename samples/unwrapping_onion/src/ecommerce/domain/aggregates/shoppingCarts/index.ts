import { ProductItem } from 'src/ecommerce/common/shoppingCarts/productItem';
import { ShoppingCartStatus } from './shoppingCartStatus';

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

  public static open(id: string, customerId: string): ShoppingCart {
    return new ShoppingCart(
      id,
      customerId,
      ShoppingCartStatus.Opened,
      [],
      new Date(),
      undefined,
      1
    );
  }

  public addProductItem(newProductItem: ProductItem): void {
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
      return;
    }

    const newQuantity = currentProductItem.quantity + quantity;
    const mergedProductItem = { productId, quantity: newQuantity };

    this._productItems = this._productItems.map((pi) =>
      pi.productId === productId ? mergedProductItem : pi
    );
  }

  public removeProductItem(productItemToRemove: ProductItem): void {
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
      return;
    }

    const mergedProductItem = { productId, quantity: newQuantity };

    this._productItems = this._productItems.map((pi) =>
      pi.productId === productId ? mergedProductItem : pi
    );
  }

  public confirm(): void {
    if (this.status !== ShoppingCartStatus.Opened) {
      throw Error('Cannot confirm to not opened shopping cart');
    }
    this._status = ShoppingCartStatus.Confirmed;
  }

  private findProductItem(
    productItems: ProductItem[],
    productId: string
  ): ProductItem | undefined {
    return productItems.find((pi) => pi.productId === productId);
  }
}
