import { Aggregate } from '#core/aggregates';
import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/common/productItem';
import { ProductItemAddedToShoppingCart } from './events/productItemAddedToShoppingCart';
import { ProductItemRemovedFromShoppingCart } from './events/productItemRemovedFromShoppingCart';
import { ShoppingCartConfirmed } from './events/shoppingCartConfirmed';
import { ShoppingCartOpened } from './events/shoppingCartOpened';
import { ShoppingCartStatus } from './shoppingCartStatus';

export class ShoppingCart extends Aggregate {
  public constructor(
    id: string,
    private _customerId: string,
    private _status: string,
    private _productItems: ProductItem[],
    private _openedAt: Date,
    private _confirmedAt: Date | undefined,
    revision: number
  ) {
    super(id, revision);
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

  public static open(id: string, customerId: string): ShoppingCart {
    const openedAt = new Date();

    const aggregate = new ShoppingCart(
      id,
      customerId,
      ShoppingCartStatus.Opened,
      [],
      new Date(),
      undefined,
      0
    );

    aggregate.enqueue(new ShoppingCartOpened(id, customerId, openedAt));

    return aggregate;
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

    this.enqueue(
      new ProductItemAddedToShoppingCart(this._id, newProductItem, new Date())
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

    this.enqueue(
      new ProductItemRemovedFromShoppingCart(
        this._id,
        productItemToRemove,
        new Date()
      )
    );
  }

  public confirm(): void {
    if (this.status !== ShoppingCartStatus.Opened) {
      throw Error('Cannot confirm to not opened shopping cart');
    }
    this._status = ShoppingCartStatus.Confirmed;
    this._confirmedAt = new Date();

    this.enqueue(new ShoppingCartConfirmed(this._id, this._confirmedAt));
  }

  private findProductItem(
    productItems: ProductItem[],
    productId: string
  ): ProductItem | undefined {
    return productItems.find((pi) => pi.productId === productId);
  }
}
