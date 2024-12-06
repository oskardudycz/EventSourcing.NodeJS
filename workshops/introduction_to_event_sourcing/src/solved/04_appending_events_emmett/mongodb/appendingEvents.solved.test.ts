import {
  getMongoDBTestClient,
  releaseMongoDBContainer,
} from '#core/testing/mongoDB';
import { type Event } from '@event-driven-io/emmett';
import {
  getMongoDBEventStore,
  MongoDBEventStore,
} from '@event-driven-io/emmett-mongodb';
import { v4 as uuid } from 'uuid';

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
  eventStore: MongoDBEventStore,
  streamName: string,
  events: ShoppingCartEvent[],
): Promise<bigint> => {
  const { nextExpectedStreamVersion } = await eventStore.appendToStream(
    streamName,
    events,
  );

  return nextExpectedStreamVersion;
};

describe('Appending events', () => {
  let eventStore: MongoDBEventStore;

  beforeAll(async () => {
    const client = await getMongoDBTestClient();

    eventStore = getMongoDBEventStore({ client });
  });

  afterAll(async () => {
    await eventStore.close();
    await releaseMongoDBContainer();
  });

  it('should append events to MongoDB', async () => {
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

    const streamName = `shopping_cart:${shoppingCartId}`;

    const appendedEventsCount = await appendToStream(
      eventStore,
      streamName,
      events,
    );

    expect(appendedEventsCount).toBe(BigInt(events.length));
  });
});
