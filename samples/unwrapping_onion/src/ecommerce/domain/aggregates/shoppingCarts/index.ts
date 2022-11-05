import { ProductItem } from 'src/ecommerce/common/shoppingCarts/productItem';
import { ShoppingCartStatus } from './shoppingCartStatus';

export default class ShoppingCart {
  public constructor(
    private _id: string,
    private _clientId: string,
    private _status: string,
    private _productItems: ProductItem[],
    private _openedAt: Date,
    private _confirmedAt: Date | undefined,
    private _revision: number
  ) {}

  public get id() {
    return this._id;
  }

  public get clientId() {
    return this._clientId;
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

  public static open(id: string, clientId: string): ShoppingCart {
    return new ShoppingCart(
      id,
      clientId,
      ShoppingCartStatus.Opened,
      [],
      new Date(),
      undefined,
      1
    );
  }

  public addProductItem(newProductItem: ProductItem): void {
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

  private findProductItem(
    productItems: ProductItem[],
    productId: string
  ): ProductItem | undefined {
    return productItems.find((pi) => pi.productId === productId);
  }
}
