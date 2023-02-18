import {
  StartedEventStoreDBContainer,
  EventStoreDBContainer,
} from '#core/testing/eventStoreDB/eventStoreDBContainer';
import {
  ANY,
  AppendResult,
  EventStoreDBClient,
  jsonEvent,
  StreamNotFoundError,
} from '@eventstore/db-client';
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
    private _canceledAt?: Date
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
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice
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
          (pi) => pi.productId === productId && pi.unitPrice === unitPrice
        );

        if (!currentProductItem) {
          return;
        }

        currentProductItem.quantity -= quantity;

        if (currentProductItem.quantity <= 0) {
          this._productItems.splice(
            this._productItems.indexOf(currentProductItem),
            1
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
    }
  };
}

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export const readStream = async <EventType extends Event>(
  eventStore: EventStoreDBClient,
  streamId: string
): Promise<EventType[]> => {
  const events = [];
  try {
    for await (const { event } of eventStore.readStream<EventType>(streamId)) {
      if (!event) continue;

      events.push(<EventType>{
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

const appendEvents = async <EventType extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  events: EventType[]
): Promise<AppendResult> => {
  const serializedEvents = events.map(jsonEvent);

  return eventStore.appendToStream(streamName, serializedEvents, {
    expectedRevision: ANY,
  });
};

export interface Evolves<E extends Event> {
  evolve(event: E): void;
}

export interface Repository<Entity> {
  find(id: string): Promise<Entity | undefined>;
}

export class EventStoreDBRepository<
  Entity extends Evolves<StreamEvent>,
  StreamEvent extends Event
> implements Repository<Entity>
{
  constructor(
    private eventStore: EventStoreDBClient,
    private getDefault: () => Entity,
    private mapToStreamId: (id: string) => string
  ) {}

  find = async (id: string): Promise<Entity | undefined> => {
    try {
      const currentState = this.getDefault();
      for await (const { event } of this.eventStore.readStream(
        this.mapToStreamId(id)
      )) {
        if (!event) continue;
        currentState.evolve(<StreamEvent>{
          type: event.type,
          data: event.data,
        });
      }
      return currentState;
    } catch (error) {
      if (error instanceof StreamNotFoundError) {
        return undefined;
      }

      throw error;
    }
  };
}

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

export const getShoppingCart = async (
  eventStore: EventStoreDBClient,
  streamId: string
): Promise<ShoppingCart | undefined> => {
  const repository = new EventStoreDBRepository(
    eventStore,
    () =>
      new ShoppingCart(
        undefined!,
        undefined!,
        undefined!,
        undefined!,
        undefined,
        undefined,
        undefined
      ),
    mapShoppingCartStreamId
  );

  return repository.find(streamId);
};

describe('Events definition', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().start();
    const connectionString = esdbContainer.getConnectionString();

    // That's how EventStoreDB client is setup
    // We're taking the connection string from container
    eventStore = EventStoreDBClient.connectionString(connectionString);
  });

  afterAll(async () => {
    if (eventStore) await eventStore.dispose();
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

    await appendEvents(
      eventStore,
      mapShoppingCartStreamId(shoppingCartId),
      events
    );

    const shoppingCart = await getShoppingCart(eventStore, shoppingCartId);

    if (!shoppingCart) {
      expect(shoppingCart).toBeDefined();
      return;
    }
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
      canceledAt
    );
    expect(actual).toStrictEqual(Object.assign({}, expected));
  });
});
