import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import {
  ANY,
  AppendResult,
  EventStoreDBClient,
  jsonEvent,
  StreamNotFoundError,
} from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';

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

export const merge = <T>(
  array: T[],
  item: T,
  where: (current: T) => boolean,
  onExisting: (current: T) => T,
  onNotFound: () => T | undefined = () => undefined,
) => {
  let wasFound = false;

  const result = array
    // merge the existing item if matches condition
    .map((p: T) => {
      if (!where(p)) return p;

      wasFound = true;
      return onExisting(p);
    })
    // filter out item if undefined was returned
    // for cases of removal
    .filter((p) => p !== undefined)
    // make TypeScript happy
    .map((p) => {
      if (!p) throw Error('That should not happen');

      return p;
    });

  // if item was not found and onNotFound action is defined
  // try to generate new item
  if (!wasFound) {
    const result = onNotFound();

    if (result !== undefined) return [...array, item];
  }

  return result;
};

export const evolve = (
  state: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened':
      return {
        id: event.shoppingCartId,
        clientId: event.clientId,
        openedAt: event.openedAt,
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
        confirmedAt: event.confirmedAt,
      };
    case 'ShoppingCartCanceled':
      return {
        ...state,
        status: ShoppingCartStatus.Canceled,
        canceledAt: event.canceledAt,
      };
    default: {
      const _: never = type;
      throw new Error('Unknown Event Type');
    }
  }
};

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export const readStream = async <StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  streamId: string,
): Promise<StreamEvent[]> => {
  const events = [];
  try {
    for await (const { event } of eventStore.readStream<StreamEvent>(
      streamId,
    )) {
      if (!event) continue;

      events.push(<StreamEvent>{
        type: event.type,
        data: event.data,
      });
    }
    return events;
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return [];
    }

    throw error;
  }
};

const appendToStream = async <StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  events: StreamEvent[],
): Promise<AppendResult> => {
  const serializedEvents = events.map(jsonEvent);

  return eventStore.appendToStream(streamName, serializedEvents, {
    expectedRevision: ANY,
  });
};

//////////////////////////////////////////
//// SERIALIZATION
//////////////////////////////////////////

export type ShoppingCartEventPayload =
  | {
      type: 'ShoppingCartOpened';
      data: {
        shoppingCartId: string;
        clientId: string;
        openedAt: string;
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
        confirmedAt: string;
      };
    }
  | {
      type: 'ShoppingCartCanceled';
      data: {
        shoppingCartId: string;
        canceledAt: string;
      };
    };

export const ShoppingCartEventSerde = {
  serialize: ({ type, data }: ShoppingCartEvent): ShoppingCartEventPayload => {
    switch (type) {
      case 'ShoppingCartOpened': {
        return {
          type,
          data: { ...data, openedAt: data.openedAt.toISOString() },
        };
      }
      case 'ProductItemAddedToShoppingCart': {
        return { type, data };
      }
      case 'ProductItemRemovedFromShoppingCart': {
        return { type, data };
      }
      case 'ShoppingCartConfirmed': {
        return {
          type,
          data: { ...data, confirmedAt: data.confirmedAt.toISOString() },
        };
      }
      case 'ShoppingCartCanceled': {
        return {
          type,
          data: { ...data, canceledAt: data.canceledAt.toISOString() },
        };
      }
    }
  },
  deserialize: ({
    type,
    data,
  }: ShoppingCartEventPayload): ShoppingCartEvent => {
    switch (type) {
      case 'ShoppingCartOpened': {
        return {
          type,
          data: { ...data, openedAt: new Date(data.openedAt) },
        };
      }
      case 'ProductItemAddedToShoppingCart': {
        return { type, data };
      }
      case 'ProductItemRemovedFromShoppingCart': {
        return { type, data };
      }
      case 'ShoppingCartConfirmed': {
        return {
          type,
          data: { ...data, confirmedAt: new Date(data.confirmedAt) },
        };
      }
      case 'ShoppingCartCanceled': {
        return {
          type,
          data: { ...data, canceledAt: new Date(data.canceledAt) },
        };
      }
    }
  },
};

export const getShoppingCart = async (
  eventStore: EventStoreDBClient,
  streamId: string,
): Promise<ShoppingCart> => {
  const events = await readStream<ShoppingCartEventPayload>(
    eventStore,
    streamId,
  );

  const deserializedEvents = events.map(ShoppingCartEventSerde.deserialize);

  if (deserializedEvents.length === 0)
    throw new Error('Shopping Cart was not found!');

  return deserializedEvents.reduce<ShoppingCart>(evolve, {} as ShoppingCart);
};

describe('Events definition', () => {
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    eventStore = await getEventStoreDBTestClient();
  });

  afterAll(async () => {
    await eventStore.dispose();
  })

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
      {
        type: 'ShoppingCartCanceled',
        data: {
          shoppingCartId,
          canceledAt,
        },
      },
    ];

    const streamName = `shopping_cart-${shoppingCartId}`;

    await appendToStream(
      eventStore,
      streamName,
      events.map(ShoppingCartEventSerde.serialize),
    );

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
