import { v4 as uuid } from 'uuid';
import {
  CommandHandler,
  decide,
  Decider,
  ShoppingCartCommand,
  ShoppingCartErrors,
} from './businessLogic';
import {
  evolve,
  getShoppingCart,
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
} from './shoppingCart';
import { getEventStore } from './core';

const decider: Decider<ShoppingCart, ShoppingCartCommand, ShoppingCartEvent> = {
  decide,
  evolve,
  getInitialState: () => ({}) as ShoppingCart,
};

export const handle = CommandHandler(decider);

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

    handle(eventStore, shoppingCartId, {
      type: 'OpenShoppingCart',
      data: { clientId, shoppingCartId, now: openedAt },
    });

    handle(eventStore, shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: twoPairsOfShoes },
    });

    handle(eventStore, shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: tShirt },
    });

    handle(eventStore, shoppingCartId, {
      type: 'RemoveProductItemFromShoppingCart',
      data: { shoppingCartId, productItem: pairOfShoes },
    });

    handle(eventStore, shoppingCartId, {
      type: 'ConfirmShoppingCart',
      data: { shoppingCartId, now: confirmedAt },
    });

    const cancel = () =>
      handle(eventStore, shoppingCartId, {
        type: 'CancelShoppingCart',
        data: { shoppingCartId, now: canceledAt },
      });

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
