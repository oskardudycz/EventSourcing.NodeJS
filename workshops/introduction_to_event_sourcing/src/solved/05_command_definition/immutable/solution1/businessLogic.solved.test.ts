import { v4 as uuid } from 'uuid';
import {
  ShoppingCartErrors,
  openShoppingCart,
  addProductItemToShoppingCart,
  removeProductItemFromShoppingCart,
  confirmShoppingCart,
  cancelShoppingCart,
} from './businessLogic';
import {
  PricedProductItem,
  ShoppingCartEvent,
  ShoppingCartStatus,
  getShoppingCart,
} from './shoppingCart';
import { getEventStore } from './core';

describe('Getting state from events', () => {
  it('Should return the state from the sequence of events', () => {
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

    eventStore.appendToStream(
      shoppingCartId,
      openShoppingCart({ clientId, shoppingCartId, now: openedAt }),
    );

    eventStore.appendToStream(
      shoppingCartId,
      addProductItemToShoppingCart(
        {
          shoppingCartId,
          productItem: twoPairsOfShoes,
        },
        getShoppingCart(eventStore.readStream(shoppingCartId)),
      ),
    );

    eventStore.appendToStream(
      shoppingCartId,
      addProductItemToShoppingCart(
        {
          shoppingCartId,
          productItem: tShirt,
        },
        getShoppingCart(eventStore.readStream(shoppingCartId)),
      ),
    );

    eventStore.appendToStream(
      shoppingCartId,
      removeProductItemFromShoppingCart(
        {
          shoppingCartId,
          productItem: pairOfShoes,
        },
        getShoppingCart(eventStore.readStream(shoppingCartId)),
      ),
    );

    eventStore.appendToStream(
      shoppingCartId,
      confirmShoppingCart(
        { shoppingCartId, now: confirmedAt },
        getShoppingCart(eventStore.readStream(shoppingCartId)),
      ),
    );

    const cancel = () =>
      eventStore.appendToStream(
        shoppingCartId,
        cancelShoppingCart(
          { shoppingCartId, now: canceledAt },
          getShoppingCart(eventStore.readStream(shoppingCartId)),
        ),
      );

    expect(cancel).toThrow(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);

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

    expect(shoppingCart).toStrictEqual({
      id: shoppingCartId,
      clientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [pairOfShoes, tShirt],
      openedAt,
      confirmedAt,
    });
  });
});
