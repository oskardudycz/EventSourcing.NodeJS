import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import {
  EventStoreDBClient,
  NO_STREAM,
  StreamNotFoundError,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import {
  EventStoreRepository,
  ShoppingCart,
  ShoppingCartErrors,
  ShoppingCartService,
} from './businessLogic';

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type Event<
  StreamEvent extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<StreamEvent>;
  data: Readonly<EventData>;
}>;

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: string;
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
    confirmedAt: string;
  }
>;

export type ShoppingCartCanceled = Event<
  'ShoppingCartCanceled',
  {
    shoppingCartId: string;
    canceledAt: string;
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

export const getShoppingCart = (events: ShoppingCartEvent[]): ShoppingCart => {
  return events.reduce<ShoppingCart>((state, event) => {
    state.evolve(event);
    return state;
  }, ShoppingCart.default());
};

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

export const readStream = async (
  eventStore: EventStoreDBClient,
  shoppingCartId: string
) => {
  try {
    const readResult = eventStore.readStream<ShoppingCartEvent>(
      mapShoppingCartStreamId(shoppingCartId)
    );

    const events: ShoppingCartEvent[] = [];

    for await (const { event } of readResult) {
      if (!event) continue;
      events.push(<ShoppingCartEvent>{ type: event.type, data: event.data });
    }

    return events;
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return [];
    }

    throw error;
  }
};

describe('Getting state from events', () => {
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    eventStore = await getEventStoreDBTestClient();
  });

  it('Should return the state from the sequence of events', async () => {
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

    const repository = new EventStoreRepository<
      ShoppingCart,
      ShoppingCartEvent
    >(eventStore, ShoppingCart.default, mapShoppingCartStreamId);

    const shoppingCartService = new ShoppingCartService(repository);

    let appendResult = await shoppingCartService.open(
      {
        shoppingCartId,
        clientId,
        now: openedAt,
      },
      NO_STREAM
    );

    appendResult = await shoppingCartService.addProductItem(
      {
        shoppingCartId,
        productItem: twoPairsOfShoes,
      },
      appendResult.nextExpectedRevision
    );

    appendResult = await shoppingCartService.addProductItem(
      {
        shoppingCartId,
        productItem: tShirt,
      },
      appendResult.nextExpectedRevision
    );

    appendResult = await shoppingCartService.removeProductItem(
      {
        shoppingCartId,
        productItem: pairOfShoes,
      },
      appendResult.nextExpectedRevision
    );

    // Let's check also negative scenario
    // when someone tried to update using too old expected revision
    const tooOldExpectedRevision = appendResult.nextExpectedRevision - 1n;

    const updateWithTooOldExpectedRevision = () =>
      shoppingCartService.confirm(
        {
          shoppingCartId,
          now: confirmedAt,
        },
        tooOldExpectedRevision
      );

    await expect(updateWithTooOldExpectedRevision).rejects.toThrow(
      WrongExpectedVersionError
    );

    appendResult = await shoppingCartService.confirm(
      {
        shoppingCartId,
        now: confirmedAt,
      },
      appendResult.nextExpectedRevision
    );

    const cancel = () =>
      shoppingCartService.cancel(
        { shoppingCartId, now: canceledAt },
        appendResult.nextExpectedRevision
      );

    await expect(cancel).rejects.toThrow(
      ShoppingCartErrors.CART_IS_ALREADY_CLOSED
    );

    const events = await readStream(eventStore, shoppingCartId);

    expect(events).toEqual([
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt: openedAt.toISOString(),
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
          confirmedAt: confirmedAt.toISOString(),
        },
      },
      // This should fail
      // {
      //   type: 'ShoppingCartCanceled',
      //   data: {
      //     shoppingCartId,
      //     canceledAt: canceledAt.toISOString(),
      //   },
      // },
    ]);

    const shoppingCart = getShoppingCart(events);

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
