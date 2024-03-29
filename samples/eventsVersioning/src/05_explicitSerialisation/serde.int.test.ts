import { v4 as uuid } from 'uuid';
import { ShoppingCartStatus } from '../04_transformations/shoppingCart';
import { EventStore, getEventStore } from '../core/eventStoreDB';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../core/testing/eventStoreDB/eventStoreDBContainer';
import { PricedProductItem } from '../events/events.v1';
import {
  Client,
  ShoppingCart,
  ShoppingCartEvent,
  evolve,
} from './shoppingCart';

//////////////////////////////////////////
//// SERIALIZATION
//////////////////////////////////////////

export type ShoppingCartEventPayload =
  | {
      type: 'ShoppingCartOpened';
      data: {
        shoppingCartId: string;
        clientId: string;
      };
    }
  | {
      type: 'ShoppingCartOpened.v2';
      data: {
        shoppingCartId: string;
        clientId: string;
        client: Client;
      };
    }
  | {
      type: 'ShoppingCartOpened.v3';
      data: {
        shoppingCartId: string;
        // obsolete, kept for backward and forward compatibility
        clientId: string;
        // New required property
        client: Client;
        // New required property
        status: ShoppingCartStatus;
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
          type: 'ShoppingCartOpened.v3',
          data: {
            shoppingCartId: data.shoppingCartId,
            clientId: data.client.id,
            client: data.client,
            status: data.status,
          },
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
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId: data.shoppingCartId,
            client: { id: data.clientId, name: 'Unknown' },
            status: ShoppingCartStatus.Opened,
          },
        };
      }
      case 'ShoppingCartOpened.v2': {
        return {
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId: data.shoppingCartId,
            client: data.client,
            status: ShoppingCartStatus.Opened,
          },
        };
      }
      case 'ShoppingCartOpened.v3': {
        return {
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId: data.shoppingCartId,
            client: data.client,
            status: data.status,
          },
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

const getShoppingCart = (
  eventStore: EventStore,
  shoppingCartId: string,
): Promise<ShoppingCart | null> => {
  return eventStore.aggregateStream<
    ShoppingCart,
    ShoppingCartEvent,
    ShoppingCartEventPayload
  >(`shoppingCart-${shoppingCartId}`, {
    getInitialState: () => {
      return {} as ShoppingCart;
    },
    evolve,
    parse: ShoppingCartEventSerde.deserialize,
  });
};

describe('Multiple transformations with different event types', () => {
  jest.setTimeout(180_000);

  let container: StartedEventStoreDBContainer;
  let eventStore: EventStore;

  beforeAll(async () => {
    container = await new EventStoreDBContainer().start();
    const client = container.getClient();
    eventStore = getEventStore(client);
  });

  afterAll(() => {
    return container.stop();
  });

  it('should read new event schema using Serde', async () => {
    const clientIds = [uuid(), uuid(), uuid()];

    const eventV1: ShoppingCartEventPayload = {
      type: 'ShoppingCartOpened',
      data: {
        clientId: clientIds[0],
        shoppingCartId: uuid(),
      },
    };

    const eventV2: ShoppingCartEventPayload = {
      type: 'ShoppingCartOpened.v2',
      data: {
        clientId: clientIds[1],
        client: { id: uuid(), name: 'Oscar the Grouch' },
        shoppingCartId: uuid(),
      },
    };

    const eventV3: ShoppingCartEventPayload = {
      type: 'ShoppingCartOpened.v3',
      data: {
        clientId: clientIds[2],
        client: { id: uuid(), name: 'Big Bird' },
        shoppingCartId: uuid(),
        status: ShoppingCartStatus.Pending,
      },
    };

    await eventStore.appendToStream(
      `shoppingCart-${eventV1.data.shoppingCartId}`,
      [eventV1],
    );

    await eventStore.appendToStream(
      `shoppingCart-${eventV2.data.shoppingCartId}`,
      [eventV2],
    );

    await eventStore.appendToStream(
      `shoppingCart-${eventV3.data.shoppingCartId}`,
      [eventV3],
    );

    // When
    const deserializedEvents = [
      (
        await eventStore.readStream<
          ShoppingCartEvent,
          ShoppingCartEventPayload
        >(`shoppingCart-${eventV1.data.shoppingCartId}`, {
          parse: ShoppingCartEventSerde.deserialize,
        })
      )[0],
      (
        await eventStore.readStream<
          ShoppingCartEvent,
          ShoppingCartEventPayload
        >(`shoppingCart-${eventV2.data.shoppingCartId}`, {
          parse: ShoppingCartEventSerde.deserialize,
        })
      )[0],
      (
        await eventStore.readStream<
          ShoppingCartEvent,
          ShoppingCartEventPayload
        >(`shoppingCart-${eventV3.data.shoppingCartId}`, {
          parse: ShoppingCartEventSerde.deserialize,
        })
      )[0],
    ];

    expect(deserializedEvents).toEqual([
      {
        type: 'ShoppingCartOpened',
        data: {
          client: { id: eventV1.data.clientId, name: 'Unknown' },
          shoppingCartId: eventV1.data.shoppingCartId,
          status: ShoppingCartStatus.Opened,
        },
      },
      {
        type: 'ShoppingCartOpened',
        data: {
          client: eventV2.data.client,
          shoppingCartId: eventV2.data.shoppingCartId,
          status: ShoppingCartStatus.Opened,
        },
      },
      {
        type: 'ShoppingCartOpened',
        data: {
          client: eventV3.data.client,
          shoppingCartId: eventV3.data.shoppingCartId,
          status: eventV3.data.status,
        },
      },
    ]);
  });

  it('should get state using Serde', async () => {
    const clientIds = [uuid(), uuid(), uuid()];

    const eventV1: ShoppingCartEventPayload = {
      type: 'ShoppingCartOpened',
      data: {
        clientId: clientIds[0],
        shoppingCartId: uuid(),
      },
    };

    const eventV2: ShoppingCartEventPayload = {
      type: 'ShoppingCartOpened.v2',
      data: {
        clientId: clientIds[1],
        client: { id: uuid(), name: 'Oscar the Grouch' },
        shoppingCartId: uuid(),
      },
    };

    const eventV3: ShoppingCartEventPayload = {
      type: 'ShoppingCartOpened.v3',
      data: {
        clientId: clientIds[2],
        client: { id: uuid(), name: 'Big Bird' },
        shoppingCartId: uuid(),
        status: ShoppingCartStatus.Pending,
      },
    };

    await eventStore.appendToStream(
      `shoppingCart-${eventV1.data.shoppingCartId}`,
      [eventV1],
    );

    await eventStore.appendToStream(
      `shoppingCart-${eventV2.data.shoppingCartId}`,
      [eventV2],
    );

    await eventStore.appendToStream(
      `shoppingCart-${eventV3.data.shoppingCartId}`,
      [eventV3],
    );

    // When
    const shoppingCarts: (ShoppingCart | null)[] = [
      await getShoppingCart(eventStore, eventV1.data.shoppingCartId),
      await getShoppingCart(eventStore, eventV2.data.shoppingCartId),
      await getShoppingCart(eventStore, eventV3.data.shoppingCartId),
    ];

    expect(shoppingCarts).toEqual([
      {
        id: eventV1.data.shoppingCartId,
        client: { id: eventV1.data.clientId, name: 'Unknown' },
        status: ShoppingCartStatus.Opened,
        productItems: [],
      },
      {
        id: eventV2.data.shoppingCartId,
        client: eventV2.data.client,
        status: ShoppingCartStatus.Opened,
        productItems: [],
      },
      {
        id: eventV3.data.shoppingCartId,
        client: eventV3.data.client,
        status: eventV3.data.status,
        productItems: [],
      },
    ]);
  });
});
