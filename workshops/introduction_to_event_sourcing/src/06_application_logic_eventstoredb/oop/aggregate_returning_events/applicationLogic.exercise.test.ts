import { v4 as uuid } from 'uuid';
import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import { EventStoreDBClient } from '@eventstore/db-client';
import { getEventStore } from '../../tools/eventStore';
import {
  AddProductItemToShoppingCart,
  CancelShoppingCart,
  ConfirmShoppingCart,
  OpenShoppingCart,
  RemoveProductItemFromShoppingCart,
  ShoppingCartErrors,
} from './businessLogic';
import {
  PricedProductItem,
  ShoppingCart,
  ShoppingCartEvent,
  ShoppingCartStatus,
  getShoppingCart,
} from './shoppingCart';

describe('Business logic', () => {
  let eventStoreDB: EventStoreDBClient;

  beforeAll(async () => {
    eventStoreDB = await getEventStoreDBTestClient();
  });

  afterAll(() => eventStoreDB.dispose());

  it('Should handle commands correctly', async () => {
    const eventStore = getEventStore(eventStoreDB);
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
    await eventStore.appendToStream(
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

    let shoppingCart = getShoppingCart(
      await eventStore.readStream(shoppingCartId),
    );

    await eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.addProductItem(addTwoPairsOfShoes.data.productItem),
    );

    // Add T-Shirt
    const addTShirt: AddProductItemToShoppingCart = {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: tShirt },
    };

    shoppingCart = getShoppingCart(await eventStore.readStream(shoppingCartId));

    await eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.addProductItem(addTShirt.data.productItem),
    );

    // Remove pair of shoes
    const removePairOfShoes: RemoveProductItemFromShoppingCart = {
      type: 'RemoveProductItemFromShoppingCart',
      data: { shoppingCartId, productItem: pairOfShoes },
    };

    shoppingCart = getShoppingCart(await eventStore.readStream(shoppingCartId));
    await eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.removeProductItem(removePairOfShoes.data.productItem),
    );

    // Confirm
    const confirm: ConfirmShoppingCart = {
      type: 'ConfirmShoppingCart',
      data: { shoppingCartId, now: confirmedAt },
    };

    shoppingCart = getShoppingCart(await eventStore.readStream(shoppingCartId));
    await eventStore.appendToStream(
      shoppingCartId,
      shoppingCart.confirm(confirm.data.now),
    );

    // Try Cancel
    const cancel: CancelShoppingCart = {
      type: 'CancelShoppingCart',
      data: { shoppingCartId, now: canceledAt },
    };
    const onCancel = async () => {
      shoppingCart = getShoppingCart(
        await eventStore.readStream(shoppingCartId),
      );
      await eventStore.appendToStream(
        shoppingCartId,
        shoppingCart.cancel(cancel.data.now),
      );
    };

    expect(onCancel).toThrow(ShoppingCartErrors.CART_IS_ALREADY_CLOSED);

    const events =
      await eventStore.readStream<ShoppingCartEvent>(shoppingCartId);

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
