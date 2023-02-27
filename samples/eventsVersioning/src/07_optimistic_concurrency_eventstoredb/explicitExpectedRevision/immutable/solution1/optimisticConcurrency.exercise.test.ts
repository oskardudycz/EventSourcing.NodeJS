import { getEventStoreDBTestClient } from '#core/testing/eventStoreDB';
import {
  EventStoreDBClient,
  NO_STREAM,
  StreamNotFoundError,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import {
  ShoppingCartErrors,
  openShoppingCart,
  addProductItemToShoppingCart,
  removeProductItemFromShoppingCart,
  confirmShoppingCart,
  cancelShoppingCart,
  handleCommand,
} from './businessLogic';

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

export enum ShoppingCartStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export const merge = <T>(
  array: T[],
  item: T,
  where: (current: T) => boolean,
  onExisting: (current: T) => T,
  onNotFound: () => T | undefined = () => undefined
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
  { type, data: event }: ShoppingCartEvent
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
          () => productItem
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
          }
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
      throw new Error(ShoppingCartErrors.UNKNOWN_EVENT_TYPE);
    }
  }
};

export const getShoppingCart = (events: ShoppingCartEvent[]): ShoppingCart => {
  return events.reduce<ShoppingCart>(evolve, {} as ShoppingCart);
};

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

const handle = handleCommand(
  evolve,
  () => ({} as ShoppingCart),
  mapShoppingCartStreamId
);

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

    let appendResult = await handle(
      eventStore,
      shoppingCartId,
      NO_STREAM,
      (_) => openShoppingCart({ clientId, shoppingCartId, now: openedAt })
    );

    appendResult = await handle(
      eventStore,
      shoppingCartId,
      appendResult.nextExpectedRevision,
      (state) =>
        addProductItemToShoppingCart(
          {
            shoppingCartId,
            productItem: twoPairsOfShoes,
          },
          state
        )
    );

    appendResult = await handle(
      eventStore,
      shoppingCartId,
      appendResult.nextExpectedRevision,
      (state) =>
        addProductItemToShoppingCart(
          {
            shoppingCartId,
            productItem: tShirt,
          },
          state
        )
    );

    appendResult = await handle(
      eventStore,
      shoppingCartId,
      appendResult.nextExpectedRevision,
      (state) =>
        removeProductItemFromShoppingCart(
          {
            shoppingCartId,
            productItem: pairOfShoes,
          },
          state
        )
    );

    // Let's check also negative scenario
    // when someone tried to update using too old expected revision
    const tooOldExpectedRevision = appendResult.nextExpectedRevision - 1n;

    const updateWithTooOldExpectedRevision = () =>
      handle(eventStore, shoppingCartId, tooOldExpectedRevision, (state) =>
        confirmShoppingCart({ shoppingCartId, now: confirmedAt }, state)
      );

    await expect(updateWithTooOldExpectedRevision).rejects.toThrow(
      WrongExpectedVersionError
    );

    await handle(
      eventStore,
      shoppingCartId,
      appendResult.nextExpectedRevision,
      (state) =>
        confirmShoppingCart({ shoppingCartId, now: confirmedAt }, state)
    );

    const cancel = () =>
      handle(
        eventStore,
        shoppingCartId,
        appendResult.nextExpectedRevision,
        (state) =>
          cancelShoppingCart({ shoppingCartId, now: canceledAt }, state)
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

    expect(shoppingCart).toStrictEqual({
      id: shoppingCartId,
      clientId,
      status: ShoppingCartStatus.Confirmed,
      productItems: [pairOfShoes, tShirt],
      openedAt,
      confirmedAt,
    });
  });
});
