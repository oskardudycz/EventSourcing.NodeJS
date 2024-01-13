import { ShoppingCartErrors } from './businessLogic';
import { Event } from '../../tools/events';

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: Date;
  }
>;

export type ProductItemAddedToShoppingCart = Event<
  'ProductItemAddedToShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
  }
>;

export type ProductItemRemovedFromShoppingCart = Event<
  'ProductItemRemovedFromShoppingCart',
  {
    shoppingCartId: string;
    productItem: PricedProductItem;
  }
>;

export type ShoppingCartConfirmed = Event<
  'ShoppingCartConfirmed',
  {
    shoppingCartId: string;
    confirmedAt: Date;
  }
>;

export type ShoppingCartCanceled = Event<
  'ShoppingCartCanceled',
  {
    shoppingCartId: string;
    canceledAt: Date;
  }
>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed
  | ShoppingCartCanceled;

export enum ShoppingCartStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export class ShoppingCart {
  private constructor(
    private _id: string,
    private _clientId: string,
    private _status: ShoppingCartStatus,
    private _openedAt: Date,
    private _productItems: PricedProductItem[] = [],
    private _confirmedAt?: Date,
    private _canceledAt?: Date,
  ) {}

  get id() {
    return this._id;
  }

  get clientId() {
    return this._clientId;
  }

  get status() {
    return this._status;
  }

  get openedAt() {
    return this._openedAt;
  }

  get productItems() {
    return this._productItems;
  }

  get confirmedAt() {
    return this._confirmedAt;
  }

  get canceledAt() {
    return this._canceledAt;
  }

  public static default = () =>
    new ShoppingCart(
      undefined!,
      undefined!,
      undefined!,
      undefined!,
      undefined,
      undefined,
      undefined,
    );

  public static open = (
    shoppingCartId: string,
    clientId: string,
    now: Date,
  ): ShoppingCartOpened => {
    return {
      type: 'ShoppingCartOpened',
      data: { shoppingCartId, clientId, openedAt: now },
    };
  };

  public addProductItem = (
    productItem: PricedProductItem,
  ): ProductItemAddedToShoppingCart => {
    this.assertIsPending();

    return {
      type: 'ProductItemAddedToShoppingCart',
      data: { productItem, shoppingCartId: this._id },
    };
  };

  public removeProductItem = (
    productItem: PricedProductItem,
  ): ProductItemRemovedFromShoppingCart => {
    this.assertIsPending();
    this.assertProductItemExists(productItem);

    return {
      type: 'ProductItemRemovedFromShoppingCart',
      data: { productItem, shoppingCartId: this._id },
    };
  };

  public confirm = (now: Date): ShoppingCartConfirmed => {
    this.assertIsPending();
    this.assertIsNotEmpty();

    return {
      type: 'ShoppingCartConfirmed',
      data: { shoppingCartId: this._id, confirmedAt: now },
    };
  };

  public cancel = (now: Date): ShoppingCartCanceled => {
    this.assertIsPending();

    return {
      type: 'ShoppingCartCanceled',
      data: { shoppingCartId: this._id, canceledAt: now },
    };
  };

  public static evolve = (
    state: ShoppingCart,
    { type, data: event }: ShoppingCartEvent,
  ): ShoppingCart => {
    switch (type) {
      case 'ShoppingCartOpened': {
        state._id = event.shoppingCartId;
        state._clientId = event.clientId;
        state._status = ShoppingCartStatus.Pending;
        state._openedAt = event.openedAt;
        state._productItems = [];
        return state;
      }
      case 'ProductItemAddedToShoppingCart': {
        const {
          productItem: { productId, quantity, unitPrice },
        } = event;

        const currentProductItem = state._productItems.find(
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice,
        );

        if (currentProductItem) {
          currentProductItem.quantity += quantity;
        } else {
          state._productItems.push({ ...event.productItem });
        }
        return state;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        const {
          productItem: { productId, quantity, unitPrice },
        } = event;

        const currentProductItem = state._productItems.find(
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice,
        );

        if (!currentProductItem) {
          return state;
        }

        currentProductItem.quantity -= quantity;

        if (currentProductItem.quantity <= 0) {
          state._productItems.splice(
            state._productItems.indexOf(currentProductItem),
            1,
          );
        }
        return state;
      }
      case 'ShoppingCartConfirmed': {
        state._status = ShoppingCartStatus.Confirmed;
        state._confirmedAt = event.confirmedAt;
        return state;
      }
      case 'ShoppingCartCanceled': {
        state._status = ShoppingCartStatus.Canceled;
        state._canceledAt = event.canceledAt;
        return state;
      }
      default: {
        const _: never = type;
        throw new Error(ShoppingCartErrors.UNKNOWN_EVENT_TYPE);
      }
    }
  };

  private assertIsPending = (): void => {
    if (this._status !== ShoppingCartStatus.Pending) {
      throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
    }
  };

  private assertProductItemExists = ({
    productId,
    quantity,
    unitPrice,
  }: PricedProductItem): void => {
    const currentQuantity =
      this.productItems.find(
        (p) => p.productId === productId && p.unitPrice == unitPrice,
      )?.quantity ?? 0;

    if (currentQuantity < quantity) {
      throw new Error(ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND);
    }
  };

  private assertIsNotEmpty = (): void => {
    if (this._productItems.length === 0) {
      throw new Error(ShoppingCartErrors.CART_IS_EMPTY);
    }
  };
}

export const getShoppingCart = (events: ShoppingCartEvent[]): ShoppingCart => {
  return events.reduce<ShoppingCart>(
    ShoppingCart.evolve,
    ShoppingCart.default(),
  );
};
