import {
  getMongoDBTestClient,
  releaseMongoDBContainer,
} from '#core/testing/mongoDB';
import { type Event, merge } from '@event-driven-io/emmett';
import {
  getMongoDBEventStore,
  type MongoDBEventStore,
} from '@event-driven-io/emmett-mongodb';
import type { MongoClient } from 'mongodb';
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

enum ShoppingCartStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCart = Readonly<{
  id: string;
  clientId: string;
  status: ShoppingCartStatus;
  productItems: PricedProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
  canceledAt?: Date;
}>;

export const evolve = (
  state: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened':
      return {
        id: event.shoppingCartId,
        clientId: event.clientId,
        openedAt: new Date(event.openedAt),
        productItems: [],
        status: ShoppingCartStatus.Pending,
      };
    case 'ProductItemAddedToShoppingCart': {
      const { productItems } = state;
      const { productItem } = event;

      return {
        ...state,
        productItems: merge(
          productItems,
          productItem,
          (p) =>
            p.productId === productItem.productId &&
            p.unitPrice === productItem.unitPrice,
          (p) => {
            return {
              ...p,
              quantity: p.quantity + productItem.quantity,
            };
          },
          () => productItem,
        ),
      };
    }
    case 'ProductItemRemovedFromShoppingCart': {
      const { productItems } = state;
      const { productItem } = event;
      return {
        ...state,
        productItems: merge(
          productItems,
          productItem,
          (p) =>
            p.productId === productItem.productId &&
            p.unitPrice === productItem.unitPrice,
          (p) => {
            return {
              ...p,
              quantity: p.quantity - productItem.quantity,
            };
          },
        ),
      };
    }
    case 'ShoppingCartConfirmed':
      return {
        ...state,
        status: ShoppingCartStatus.Confirmed,
        confirmedAt: new Date(event.confirmedAt),
      };
    case 'ShoppingCartCanceled':
      return {
        ...state,
        status: ShoppingCartStatus.Canceled,
        canceledAt: new Date(event.canceledAt),
      };
    default: {
      const _: never = type;
      throw new Error('Unknown Event Type');
    }
  }
};

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

export const getShoppingCart = async (
  eventStore: MongoDBEventStore,
  streamId: string,
): Promise<ShoppingCart> => {
  const { state } = await eventStore.aggregateStream(streamId, {
    evolve,
    initialState: () => ({}) as ShoppingCart,
  });

  return state;
};

describe('Events definition', () => {
  let eventStore: MongoDBEventStore;
  let client: MongoClient;

  beforeAll(async () => {
    client = await getMongoDBTestClient();

    eventStore = getMongoDBEventStore({ client });
  });

  afterAll(async () => {
    await client.close();
    await releaseMongoDBContainer();
  });

  it('all event types should be defined', async () => {
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

    const events: ShoppingCartEvent[] = [
      // 2. Put your sample events here
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
      {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId,
          canceledAt: canceledAt.toISOString(),
        },
      },
    ];

    const streamName = `shopping_cart:${shoppingCartId}`;

    await appendToStream(eventStore, streamName, events);

    const shoppingCart = await getShoppingCart(eventStore, streamName);

    expect(shoppingCart).toEqual({
      id: shoppingCartId,
      clientId,
      status: ShoppingCartStatus.Canceled,
      productItems: [pairOfShoes, tShirt],
      openedAt,
      confirmedAt,
      canceledAt,
    });
  });
});
