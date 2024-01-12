import { v4 as uuid } from 'uuid';
import {
  AddProductItemToShoppingCart,
  CancelShoppingCart,
  ConfirmShoppingCart,
  OpenShoppingCart,
  RemoveProductItemFromShoppingCart,
  ShoppingCartErrors,
} from './businessLogic';
import { getEventStore } from './core';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
  getShoppingCart,
} from './shoppingCart';

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

    // Open
    const open: OpenShoppingCart = {
      type: 'OpenShoppingCart',
      data: { shoppingCartId, clientId, now: openedAt },
    };
    eventStore.appendToStream(
      shoppingCartId,
      ShoppingCart.open(
        open.data.shoppingCartId,
        open.data.clientId,
        open.data.now,
      ),
    );

    // Add Two Pair of Shoes
    const addTwoPairsOfShoes: AddProductItemToShoppingCart = {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: twoPairsOfShoes },
    };

    let shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));

    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.addProductItem(addTwoPairsOfShoes.data.productItem),
    );

    // Add T-Shirt
    const addTShirt: AddProductItemToShoppingCart = {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: tShirt },
    };

    shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));

    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.addProductItem(addTShirt.data.productItem),
    );

    // Remove pair of shoes
    const removePairOfShoes: RemoveProductItemFromShoppingCart = {
      type: 'RemoveProductItemFromShoppingCart',
      data: { shoppingCartId, productItem: pairOfShoes },
    };

    shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));
    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.removeProductItem(removePairOfShoes.data.productItem),
    );

    // Confirm
    const confirm: ConfirmShoppingCart = {
      type: 'ConfirmShoppingCart',
      data: { shoppingCartId, now: confirmedAt },
    };

    shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));
    eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.confirm(confirm.data.now),
    );

    // Try Cancel
    const cancel: CancelShoppingCart = {
      type: 'CancelShoppingCart',
      data: { shoppingCartId, now: canceledAt },
    };
    const onCancel = () => {
      shoppingCart = getShoppingCart(eventStore.readStream(shoppingCartId));
      eventStore.appendToStream(
        shoppingCartId,
        shoppingCart.cancel(cancel.data.now),
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
