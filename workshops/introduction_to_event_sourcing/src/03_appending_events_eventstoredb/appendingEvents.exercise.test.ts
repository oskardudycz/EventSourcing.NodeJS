import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#core/testing/eventStoreDB/eventStoreDBContainer';
import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';

// 1. Define your events and entity here

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type ShoppingCartEvent =
  | {
      type: 'ShoppingCartOpened';
      data: {
        shoppingCartId: string;
        clientId: string;
        openedAt: Date;
      };
    }
  | {
      type: 'ProductItemAddedToShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ProductItemRemovedFromShoppingCart';
      data: {
        shoppingCartId: string;
        productItem: PricedProductItem;
      };
    }
  | {
      type: 'ShoppingCartConfirmed';
      data: {
        shoppingCartId: string;
        confirmedAt: Date;
      };
    }
  | {
      type: 'ShoppingCartCanceled';
      data: {
        shoppingCartId: string;
        canceledAt: Date;
      };
    };

const appendEvents = async (
  _eventStore: EventStoreDBClient,
  _streamName: string,
  _events: ShoppingCartEvent[]
): Promise<bigint> => {
  // TODO: Fill append events logic here.
  return Promise.reject('Not implemented!');
};

describe('Appending events', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().start();
    const connectionString = esdbContainer.getConnectionString();
    console.log(connectionString);

    // That's how EventStoreDB client is setup
    // We're taking the connection string from container
    eventStore = EventStoreDBClient.connectionString(connectionString);
  });

  afterAll(async () => {
    if (eventStore) await eventStore.dispose();
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

    const appendedEventsCount = await appendEvents(
      eventStore,
      streamName,
      events
    );

    expect(appendedEventsCount).toBe(events.length - 1);
  });
});
