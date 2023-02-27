//////////////////////////////////////
/// Commands
//////////////////////////////////////

import {
  EventStore,
  PricedProductItem,
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCart,
  ShoppingCartCanceled,
  ShoppingCartConfirmed,
  ShoppingCartOpened,
  ShoppingCartStatus,
} from './businessLogic.solved.test';

export type OpenShoppingCart = {
  shoppingCartId: string;
  clientId: string;
  now: Date;
};

export type AddProductItemToShoppingCart = {
  shoppingCartId: string;
  productItem: PricedProductItem;
};

export type RemoveProductItemFromShoppingCart = {
  shoppingCartId: string;
  productItem: PricedProductItem;
};

export type ConfirmShoppingCart = {
  shoppingCartId: string;
  now: Date;
};

export type CancelShoppingCart = {
  shoppingCartId: string;
  now: Date;
};

export type ShoppingCartCommand =
  | OpenShoppingCart
  | AddProductItemToShoppingCart
  | RemoveProductItemFromShoppingCart
  | ConfirmShoppingCart
  | CancelShoppingCart;

//////////////////////////////////////
/// Decide
//////////////////////////////////////

export const enum ShoppingCartErrors {
  CART_ALREADY_EXISTS = 'CART_ALREADY_EXISTS',
  CART_IS_ALREADY_CLOSED = 'CART_IS_ALREADY_CLOSED',
  PRODUCT_ITEM_NOT_FOUND = 'PRODUCT_ITEM_NOT_FOUND',
  CART_IS_EMPTY = 'CART_IS_EMPTY',
  UNKNOWN_EVENT_TYPE = 'UNKNOWN_EVENT_TYPE',
  UNKNOWN_COMMAND_TYPE = 'UNKNOWN_COMMAND_TYPE',
}

export const assertProductItemExists = (
  productItems: PricedProductItem[],
  { productId, quantity, unitPrice }: PricedProductItem
): void => {
  const currentQuantity =
    productItems.find(
      (p) => p.productId === productId && p.unitPrice == unitPrice
    )?.quantity ?? 0;

  if (currentQuantity < quantity) {
    throw new Error(ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND);
  }
};

export const openShoppingCart = (
  command: OpenShoppingCart
): ShoppingCartOpened => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: command.shoppingCartId,
      clientId: command.clientId,
      openedAt: command.now,
    },
  };
};

export const addProductItemToShoppingCart = (
  command: AddProductItemToShoppingCart,
  shoppingCart: ShoppingCart
): ProductItemAddedToShoppingCart => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }
  return {
    type: 'ProductItemAddedToShoppingCart',
    data: {
      shoppingCartId: command.shoppingCartId,
      productItem: command.productItem,
    },
  };
};

export const removeProductItemFromShoppingCart = (
  command: RemoveProductItemFromShoppingCart,
  shoppingCart: ShoppingCart
): ProductItemRemovedFromShoppingCart => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }

  assertProductItemExists(shoppingCart.productItems, command.productItem);

  return {
    type: 'ProductItemRemovedFromShoppingCart',
    data: {
      shoppingCartId: command.shoppingCartId,
      productItem: command.productItem,
    },
  };
};

export const confirmShoppingCart = (
  command: ConfirmShoppingCart,
  shoppingCart: ShoppingCart
): ShoppingCartConfirmed => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }

  if (shoppingCart.productItems.length === 0) {
    throw new Error(ShoppingCartErrors.CART_IS_EMPTY);
  }

  return {
    type: 'ShoppingCartConfirmed',
    data: {
      shoppingCartId: command.shoppingCartId,
      confirmedAt: command.now,
    },
  };
};

export const cancelShoppingCart = (
  command: CancelShoppingCart,
  shoppingCart: ShoppingCart
): ShoppingCartCanceled => {
  if (shoppingCart.status !== ShoppingCartStatus.Pending) {
    throw new Error(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);
  }

  return {
    type: 'ShoppingCartCanceled',
    data: {
      shoppingCartId: command.shoppingCartId,
      canceledAt: command.now,
    },
  };
};

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export const handleCommand =
  <State, StreamEvent extends Event>(
    evolve: (state: State, event: StreamEvent) => State,
    getInitialState: () => State
  ) =>
  (
    eventStore: EventStore,
    id: string,
    handle: (state: State) => StreamEvent | StreamEvent[]
  ) => {
    const events = eventStore.readStream<StreamEvent>(id);

    const state = events.reduce<State>(evolve, getInitialState());

    const result = handle(state);

    eventStore.appendToStream(id, Array.isArray(result) ? result : [result]);
  };
