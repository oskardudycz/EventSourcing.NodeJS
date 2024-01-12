import { v4 as uuid } from 'uuid';
import {
  AddProductItemToShoppingCart,
  CancelShoppingCart,
  ConfirmShoppingCart,
  OpenShoppingCart,
  RemoveProductItemFromShoppingCart,
} from './businessLogic';
import { getEventStore } from './core';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartErrors,
  ShoppingCartEvent,
  ShoppingCartStatus,
  getShoppingCart,
} from './shoppingCart';

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

    // Open
    const open: OpenShoppingCart = { shoppingCartId, clientId, now: openedAt };

    eventStore.appendToStream(
      shoppingCartId,
      ShoppingCart.open(open.shoppingCartId, open.clientId, open.now),
    );

    // Add Two Pair of Shoes
    const addTwoPairsOfShoes: AddProductItemToShoppingCart = {
      shoppingCartId,
      productItem: twoPairsOfShoes,
    };

    let shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));

    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.addProductItem(addTwoPairsOfShoes.productItem),
    );

    // Add T-Shirt
    const addTShirt: AddProductItemToShoppingCart = {
      shoppingCartId,
      productItem: tShirt,
    };

    shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));

    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.addProductItem(addTShirt.productItem),
    );

    // Remove pair of shoes
    const removePairOfShoes: RemoveProductItemFromShoppingCart = {
      shoppingCartId,
      productItem: pairOfShoes,
    };

    shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));
    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.removeProductItem(removePairOfShoes.productItem),
    );

    // Confirm
    const confirm: ConfirmShoppingCart = {
      shoppingCartId,
      now: confirmedAt,
    };

    shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));
    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.confirm(confirm.now),
    );

    const cancel: CancelShoppingCart = {
      shoppingCartId,
      now: canceledAt,
    };
    const onCancel = () => {
      shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));
      eventStore.appendToStream(
        shoppingCartId,
        shoppingCart.cancel(cancel.now),
      );
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

    shoppingCart = getShoppingCart(events);

    expect(shoppingCart).toBeInstanceOf(ShoppingCart);
    const actual = {
      shoppingCartId: shoppingCart.id,
      clientId: shoppingCart.clientId,
      status: shoppingCart.status,
      openedAt: shoppingCart.openedAt,
      productItems: shoppingCart.productItems,
      confirmedAt: shoppingCart.confirmedAt,
    };

    expect(actual).toEqual({
      shoppingCartId,
      clientId,
      status: ShoppingCartStatus.Confirmed,
      openedAt,
      productItems: [pairOfShoes, tShirt],
      confirmedAt,
    });
  });
});
