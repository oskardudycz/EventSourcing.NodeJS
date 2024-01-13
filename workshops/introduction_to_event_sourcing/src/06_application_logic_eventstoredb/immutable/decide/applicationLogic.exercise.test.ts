import { v4 as uuid } from 'uuid';
import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import { EventStoreDBClient } from '@eventstore/db-client';
import { getEventStore } from '../../tools/eventStore';
import {
  AddProductItemToShoppingCart,
  CancelShoppingCart,
  ConfirmShoppingCart,
  decide,
  OpenShoppingCart,
  RemoveProductItemFromShoppingCart,
  ShoppingCartErrors,
} from './businessLogic';
import {
  emptyShoppingCart,
  getShoppingCart,
  PricedProductItem,
  ShoppingCartEvent,
  ShoppingCartStatus,
} from './shoppingCart';

describe('Application logic', () => {
  let eventStoreDB: EventStoreDBClient;

  beforeAll(async () => {
    eventStoreDB = await getEventStoreDBTestClient();
  });

  afterAll(() => eventStoreDB.dispose());

  it('Should handle requests correctly', async () => {
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

    let result: ShoppingCartEvent[] = [];

    // Open
    const open: OpenShoppingCart = {
      type: 'OpenShoppingCart',
      data: { shoppingCartId, clientId, now: openedAt },
    };
    result = [decide(open, emptyShoppingCart)];
    await eventStore.appendToStream(shoppingCartId, ...result);

    // Add Two Pair of Shoes
    const addTwoPairsOfShoes: AddProductItemToShoppingCart = {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: twoPairsOfShoes },
    };

    let state = getShoppingCart(await eventStore.readStream(shoppingCartId));
    result = [decide(addTwoPairsOfShoes, state)];

    await eventStore.appendToStream(shoppingCartId, ...result);

    // Add T-Shirt
    const addTShirt: AddProductItemToShoppingCart = {
      type: 'AddProductItemToShoppingCart',
      data: { shoppingCartId, productItem: tShirt },
    };

    state = getShoppingCart(await eventStore.readStream(shoppingCartId));
    result = [decide(addTShirt, state)];
    await eventStore.appendToStream(shoppingCartId, ...result);

    // Remove pair of shoes
    const removePairOfShoes: RemoveProductItemFromShoppingCart = {
      type: 'RemoveProductItemFromShoppingCart',
      data: { shoppingCartId, productItem: pairOfShoes },
    };

    state = getShoppingCart(await eventStore.readStream(shoppingCartId));
    result = [decide(removePairOfShoes, state)];
    await eventStore.appendToStream(shoppingCartId, ...result);

    // Confirm
    const confirm: ConfirmShoppingCart = {
      type: 'ConfirmShoppingCart',
      data: { shoppingCartId, now: confirmedAt },
    };

    state = getShoppingCart(await eventStore.readStream(shoppingCartId));
    result = [decide(confirm, state)];
    await eventStore.appendToStream(shoppingCartId, ...result);

    // Try Cancel
    const cancel: CancelShoppingCart = {
      type: 'CancelShoppingCart',
      data: { shoppingCartId, now: canceledAt },
    };
    const onCancel = async () => {
      state = getShoppingCart(await eventStore.readStream(shoppingCartId));
      result = [decide(cancel, state)];
      await eventStore.appendToStream(shoppingCartId, ...result);
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
