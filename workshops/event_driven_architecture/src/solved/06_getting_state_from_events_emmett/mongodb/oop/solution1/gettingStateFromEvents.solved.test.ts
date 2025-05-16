import {
  getMongoDBTestClient,
  releaseMongoDBContainer,
} from '#core/testing/mongoDB';
import { type Event } from '@event-driven-io/emmett';
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

export const appendToStream = async (
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
    evolve: (cart: ShoppingCart, event: ShoppingCartEvent) => {
      cart.evolve(event);
      return cart;
    },
    initialState: () =>
      new ShoppingCart(
        undefined!,
        undefined!,
        undefined!,
        undefined!,
        undefined,
        undefined,
        undefined,
      ),
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
