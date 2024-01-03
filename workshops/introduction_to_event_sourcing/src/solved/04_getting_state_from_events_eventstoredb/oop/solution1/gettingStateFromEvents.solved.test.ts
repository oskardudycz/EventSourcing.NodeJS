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

enum ShoppingCartStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export class ShoppingCart {
  constructor(
    private _id: string,
    private _clientId: string,
    private _status: ShoppingCartStatus,
    private _openedAt: Date,
    private _productItems: PricedProductItem[] = [],
    private _confirmedAt?: Date,
    private _canceledAt?: Date,
  ) {}

  get id() {
    return this._id;
  }

  get clientId() {
    return this._clientId;
  }

  get status() {
    return this._status;
  }

  get openedAt() {
    return this._openedAt;
  }

  get productItems() {
    return this._productItems;
  }

  get confirmedAt() {
    return this._confirmedAt;
  }

  get canceledAt() {
    return this._canceledAt;
  }

  public evolve = ({ type, data: event }: ShoppingCartEvent): void => {
    switch (type) {
      case 'ShoppingCartOpened': {
        this._id = event.shoppingCartId;
        this._clientId = event.clientId;
        this._status = ShoppingCartStatus.Pending;
        this._openedAt = new Date(event.openedAt);
        this._productItems = [];
        return;
      }
      case 'ProductItemAddedToShoppingCart': {
        const {
          productItem: { productId, quantity, unitPrice },
        } = event;

        const currentProductItem = this._productItems.find(
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice,
        );

        if (currentProductItem) {
          currentProductItem.quantity += quantity;
        } else {
          this._productItems.push(event.productItem);
        }
        return;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        const {
          productItem: { productId, quantity, unitPrice },
        } = event;

        const currentProductItem = this._productItems.find(
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice,
        );

        if (!currentProductItem) {
          return;
        }

        currentProductItem.quantity -= quantity;

        if (currentProductItem.quantity <= 0) {
          this._productItems.splice(
            this._productItems.indexOf(currentProductItem),
            1,
          );
        }
        return;
      }
      case 'ShoppingCartConfirmed': {
        this._status = ShoppingCartStatus.Confirmed;
        this._confirmedAt = new Date(event.confirmedAt);
        return;
      }
      case 'ShoppingCartCanceled': {
        this._status = ShoppingCartStatus.Canceled;
        this._canceledAt = new Date(event.canceledAt);
        return;
      }
      default: {
        const _: never = type;
        throw new Error('Unknown Event Type');
      }
    }
  };
}

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

export const getShoppingCart = async (
  eventStore: EventStoreDBClient,
  streamId: string,
): Promise<ShoppingCart> => {
  const events = await readStream<ShoppingCartEvent>(eventStore, streamId);

  if (events.length === 0) throw new Error('Shopping Cart was not found!');

  return events.reduce<ShoppingCart>(
    (state, event) => {
      state.evolve(event);
      return state;
    },
    new ShoppingCart(
      undefined!,
      undefined!,
      undefined!,
      undefined!,
      undefined,
      undefined,
      undefined,
    ),
  );
};

describe('Events definition', () => {
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    eventStore = await getEventStoreDBTestClient();
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

    const streamName = `shopping_cart-${shoppingCartId}`;

    await appendToStream(eventStore, streamName, events);

    const shoppingCart = await getShoppingCart(eventStore, streamName);

    expect(shoppingCart.openedAt).toBeInstanceOf(Date);
    expect(shoppingCart.confirmedAt).toBeInstanceOf(Date);
    expect(shoppingCart.canceledAt).toBeInstanceOf(Date);

    const { evolve: _, ...actual } = shoppingCart;
    const { evolve: __, ...expected } = new ShoppingCart(
      shoppingCartId,
      clientId,
      ShoppingCartStatus.Canceled,
      openedAt,
      [pairOfShoes, tShirt],
      confirmedAt,
      canceledAt,
    );
    expect(actual).toStrictEqual(Object.assign({}, expected));
  });
});
