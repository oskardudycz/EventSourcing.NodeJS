import { type Event } from '@event-driven-io/emmett';
import {
  getPostgreSQLEventStore,
  PostgresEventStore,
} from '@event-driven-io/emmett-postgresql/.';
import { v4 as uuid } from 'uuid';
import {
  getPostgreSQLConnectionString,
  releasePostgreSqlContainer,
} from '../../core/testing/postgreSQL';

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
  _eventStore: PostgresEventStore,
  _streamName: string,
  _events: ShoppingCartEvent[],
): Promise<bigint> => {
  // TODO: Fill append events logic here.
  return Promise.reject(new Error('Not implemented!'));
};

describe('Appending events', () => {
  let eventStore: PostgresEventStore;

  beforeAll(async () => {
    const connectionString = await getPostgreSQLConnectionString();

    eventStore = getPostgreSQLEventStore(connectionString);
  });

  afterAll(async () => {
    await eventStore.close();
    await releasePostgreSqlContainer();
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

    const streamName = `shopping_cart:${shoppingCartId}`;

    const appendedEventsCount = await appendToStream(
      eventStore,
      streamName,
      events,
    );

    expect(appendedEventsCount).toBe(BigInt(events.length));
  });
});
