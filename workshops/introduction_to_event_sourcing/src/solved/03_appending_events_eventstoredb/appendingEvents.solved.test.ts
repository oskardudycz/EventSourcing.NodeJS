import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import {
  ANY,
  type AppendResult,
  EventStoreDBClient,
  jsonEvent,
} from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    openedAt: Date;
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
    confirmedAt: Date;
  }
>;

export type ShoppingCartCanceled = Event<
  'ShoppingCartCanceled',
  {
    shoppingCartId: string;
    canceledAt: Date;
  }
>;

export type ShoppingCartEvent =
  | ShoppingCartOpened
  | ProductItemAddedToShoppingCart
  | ProductItemRemovedFromShoppingCart
  | ShoppingCartConfirmed
  | ShoppingCartCanceled;

const appendToStream = async (
  eventStore: EventStoreDBClient,
  streamName: string,
  events: ShoppingCartEvent[],
): Promise<AppendResult> => {
  const serializedEvents = events.map(jsonEvent);

  return eventStore.appendToStream(streamName, serializedEvents, {
    expectedRevision: ANY,
  });
};

describe('Appending events', () => {
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    // That's how EventStoreDB client is setup
    // We're taking the connection string from container
    eventStore = await getEventStoreDBTestClient();
  });

  it('should append events to EventStoreDB', async () => {
    const shoppingCartId = uuid();
    const clientId = uuid();
    const pairOfShoes: PricedProductItem = {
      productId: uuid(),
      quantity: 1,
      unitPrice: 100,
    };

    const events: ShoppingCartEvent[] = [
      // 2. Put your sample events here
      {
        type: 'ShoppingCartOpened',
        data: {
          shoppingCartId,
          clientId,
          openedAt: new Date(),
        },
      },
      {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem: pairOfShoes,
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
          confirmedAt: new Date(),
        },
      },
      {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId,
          canceledAt: new Date(),
        },
      },
    ];

    const streamName = `shopping_cart-${shoppingCartId}`;

    const appendResult = await appendToStream(eventStore, streamName, events);

    expect(Number(appendResult.nextExpectedRevision)).toBe(events.length - 1);
  });
});
