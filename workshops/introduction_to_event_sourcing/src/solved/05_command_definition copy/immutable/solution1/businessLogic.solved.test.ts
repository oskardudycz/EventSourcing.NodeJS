import { v4 as uuid } from 'uuid';
import {
  ShoppingCartErrors,
  openShoppingCart,
  addProductItemToShoppingCart,
  removeProductItemFromShoppingCart,
  confirmShoppingCart,
  cancelShoppingCart,
  handleCommand,
} from './businessLogic';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
  evolve,
  getShoppingCart,
} from './shoppingCart';
import { getEventStore } from './core';

const handle = handleCommand(evolve, () => ({}) as ShoppingCart);

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

    handle(eventStore, shoppingCartId, (_) =>
      openShoppingCart({ clientId, shoppingCartId, now: openedAt }),
    );

    handle(eventStore, shoppingCartId, (state) =>
      addProductItemToShoppingCart(
        {
          shoppingCartId,
          productItem: twoPairsOfShoes,
        },
        state,
      ),
    );

    handle(eventStore, shoppingCartId, (state) =>
      addProductItemToShoppingCart(
        {
          shoppingCartId,
          productItem: tShirt,
        },
        state,
      ),
    );

    handle(eventStore, shoppingCartId, (state) =>
      removeProductItemFromShoppingCart(
        {
          shoppingCartId,
          productItem: pairOfShoes,
        },
        state,
      ),
    );

    handle(eventStore, shoppingCartId, (state) =>
      confirmShoppingCart({ shoppingCartId, now: confirmedAt }, state),
    );

    const cancel = () =>
      handle(eventStore, shoppingCartId, (state) =>
        cancelShoppingCart({ shoppingCartId, now: canceledAt }, state),
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
