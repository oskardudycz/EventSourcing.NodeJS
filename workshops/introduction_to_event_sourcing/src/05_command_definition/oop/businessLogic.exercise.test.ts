/* eslint-disable @typescript-eslint/no-unused-vars */
import { v4 as uuid } from 'uuid';
import { getEventStore } from './core';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
  getShoppingCart,
} from './shoppingCart';
import {
  AddProductItemToShoppingCart,
  CancelShoppingCart,
  ConfirmShoppingCart,
  OpenShoppingCart,
  RemoveProductItemFromShoppingCart,
  ShoppingCartErrors,
} from './businessLogic';

describe('Business logic', () => {
  it('Should handle commands correctly', () => {
    const eventStore = getEventStore();
    const shoppingCartId = uuid();

    const clientId = uuid();
    const openedAt = new Date();
    const confirmedAt = new Date();
    const canceledAt = new Date();

    const shoesId = uuid();

    const twoPairsOfShoes: PricedProductItem = {
      productId: shoesId,
      quantity: 2,
      unitPrice: 100,
    };
    const pairOfShoes: PricedProductItem = {
      productId: shoesId,
      quantity: 1,
      unitPrice: 100,
    };

    const tShirtId = uuid();
    const tShirt: PricedProductItem = {
      productId: tShirtId,
      quantity: 1,
      unitPrice: 5,
    };

    const result: ShoppingCartEvent[] = [];

    // Open
    const open: OpenShoppingCart = { shoppingCartId, clientId, now: openedAt };
    // result = // run your business logic here

    eventStore.appendToStream(shoppingCartId, ...result);

    // Add Two Pair of Shoes
    const addTwoPairsOfShoes: AddProductItemToShoppingCart = {
      shoppingCartId,
      productItem: twoPairsOfShoes,
    };

    let state = getShoppingCart(eventStore.readStream(shoppingCartId));
    // result = // run your business logic here based on command and state

    eventStore.appendToStream(shoppingCartId, ...result);

    // Add T-Shirt
    const addTShirt: AddProductItemToShoppingCart = {
      shoppingCartId,
      productItem: tShirt,
    };

    state = getShoppingCart(eventStore.readStream(shoppingCartId));
    // result = // run your business logic here based on command and state
    eventStore.appendToStream(shoppingCartId, ...result);

    // Remove pair of shoes
    const removePairOfShoes: RemoveProductItemFromShoppingCart = {
      shoppingCartId,
      productItem: pairOfShoes,
    };

    state = getShoppingCart(eventStore.readStream(shoppingCartId));
    // result = // run your business logic here based on command and state
    eventStore.appendToStream(shoppingCartId, ...result);

    // Confirm
    const confirm: ConfirmShoppingCart = {
      shoppingCartId,
      now: confirmedAt,
    };

    state = getShoppingCart(eventStore.readStream(shoppingCartId));
    // result = // run your business logic here based on command and state
    eventStore.appendToStream(shoppingCartId, ...result);

    // Try Cancel
    const cancel: CancelShoppingCart = {
      shoppingCartId,
      now: canceledAt,
    };
    const onCancel = () => {
      state = getShoppingCart(eventStore.readStream(shoppingCartId));
      // result = // run your business logic here based on command and state
      eventStore.appendToStream(shoppingCartId, ...result);
    };

    expect(onCancel).toThrow(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);

    const events = eventStore.readStream<ShoppingCartEvent>(shoppingCartId);

    expect(events).toEqual([
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: twoPairsOfShoes,
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: tShirt,
        },
      },
      {
        type: 'ProductItemRemovedFromShoppingCart',
        data: { shoppingCartId, productItem: pairOfShoes },
      },
      {
        type: 'ShoppingCartConfirmed',
        data: {
          shoppingCartId,
          confirmedAt,
        },
      },
      // This should fail
      // {
      //   type: 'ShoppingCartCanceled',
      //   data: {
      //     shoppingCartId,
      //     canceledAt,
      //   },
      // },
    ]);

    const shoppingCart = getShoppingCart(events);

    expect(shoppingCart).toBeInstanceOf(ShoppingCart);
    expect(JSON.stringify(shoppingCart)).toBe(
      JSON.stringify(
        new ShoppingCart(
          shoppingCartId,
          clientId,
          ShoppingCartStatus.Confirmed,
          openedAt,
          [pairOfShoes, tShirt],
          confirmedAt,
        ),
      ),
    );
  });
});
