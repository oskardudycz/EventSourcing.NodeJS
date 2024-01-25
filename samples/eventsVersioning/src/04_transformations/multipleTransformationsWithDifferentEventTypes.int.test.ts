import { Event } from '#core/event';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#core/testing/eventStoreDB/eventStoreDBContainer';
import {
  EventData,
  EventTypeToRecordedEvent,
  jsonEvent,
} from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { EventStore, getEventStore } from '../core/eventStoreDB';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from '../events/events.v1';
import {
  ShoppingCartOpened,
  ShoppingCartOpenedWithStatus,
  ShoppingCartStatus,
} from './shoppingCart';

export type ShoppingCartOpenedObsoleteVersions =
  | ShoppingCartOpenedV1
  | ShoppingCartOpened;

export type ShoppingCartOpenedAllVersions = Omit<ShoppingCartOpenedV1, 'type'> &
  Omit<ShoppingCartOpened, 'type'> &
  ShoppingCartOpenedWithStatus;

export const upcastShoppingCartOpened = ({
  type,
  data,
}: ShoppingCartOpenedObsoleteVersions): ShoppingCartOpenedWithStatus => {
  switch (type) {
    case 'ShoppingCartOpened': {
      return {
        type: 'ShoppingCartOpened.v3',
        data: {
          shoppingCartId: data.shoppingCartId,
          client: { id: data.clientId, name: 'Unknown' },
          status: ShoppingCartStatus.Opened,
        },
      };
    }
    case 'ShoppingCartOpened.v2': {
      return {
        type: 'ShoppingCartOpened.v3',
        data: {
          ...data,
          status: ShoppingCartStatus.Opened,
        },
      };
    }
    default: {
      const _: never = data;
      return data;
    }
  }
};

export const downcastShoppingCartOpened = ({
  type,
  data,
}: ShoppingCartOpenedWithStatus): ShoppingCartOpenedAllVersions => {
  return {
    type,
    data: {
      ...data,
      clientId: data.client.id,
    },
  };
};

export class EventTransformations {
  #upcasters = new Map<string, (event: Event) => Event>();
  #downcasters = new Map<string, (event: Event) => Event>();

  public register = {
    upcaster: <From extends Event, To extends Event = From>(
      eventType: string,
      upcaster: (event: From) => To,
    ) => {
      this.#upcasters.set(eventType, (event) => upcaster(event as From));

      return this.register;
    },
    downcaster: <From extends Event, To extends Event = From>(
      eventType: string,
      downcaster: (event: From) => To,
    ) => {
      this.#downcasters.set(eventType, (event) => downcaster(event as From));

      return this.register;
    },
  };

  public get = {
    upcaster: (eventType: string) => this.#upcasters.get(eventType),

    downcaster: (eventType: string) => this.#downcasters.get(eventType),
  };
}

export class EventParser {
  constructor(private eventTransformations: EventTransformations) {}

  public parse<E extends Event = Event>(
    recordedEvent: EventTypeToRecordedEvent<E>,
  ) {
    const upcaster = this.eventTransformations.get.upcaster(recordedEvent.type);

    const parsed = { type: recordedEvent.type, data: recordedEvent.data };

    return upcaster ? upcaster(parsed) : <E>parsed;
  }

  public stringify<E extends Event = Event>(event: E): EventData {
    const downcaster = this.eventTransformations.get.downcaster(event.type);

    return jsonEvent(downcaster ? downcaster(event) : event);
  }
}

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

  it('upcast should be forward compatible', async () => {
    const eventTransformations = new EventTransformations();
    eventTransformations.register
      .upcaster('ShoppingCartOpened', upcastShoppingCartOpened)
      .upcaster('ShoppingCartOpened.v2', upcastShoppingCartOpened)
      .downcaster('ShoppingCartOpened.v3', downcastShoppingCartOpened);

    const parser = new EventParser(eventTransformations);

    // Given
    const eventV1: ShoppingCartOpenedV1 = {
      type: 'ShoppingCartOpened',
      data: {
        clientId: uuid(),
        shoppingCartId: uuid(),
      },
    };

    const eventV2: ShoppingCartOpened = {
      type: 'ShoppingCartOpened.v2',
      data: {
        client: { id: uuid(), name: 'Oscar the Grouch' },
        shoppingCartId: uuid(),
      },
    };

    const eventV3: ShoppingCartOpenedWithStatus = {
      type: 'ShoppingCartOpened.v3',
      data: {
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
        await eventStore.readStream(
          `shoppingCart-${eventV1.data.shoppingCartId}`,
          { parse: (e) => parser.parse(e) },
        )
      )[0],
      (
        await eventStore.readStream(
          `shoppingCart-${eventV2.data.shoppingCartId}`,
          { parse: (e) => parser.parse(e) },
        )
      )[0],
      (
        await eventStore.readStream(
          `shoppingCart-${eventV3.data.shoppingCartId}`,
          { parse: (e) => parser.parse(e) },
        )
      )[0],
    ];

    expect(deserializedEvents).toEqual([
      {
        type: 'ShoppingCartOpened.v3',
        data: {
          client: { id: eventV1.data.clientId, name: 'Unknown' },
          shoppingCartId: eventV1.data.shoppingCartId,
          status: ShoppingCartStatus.Opened,
        },
      },
      {
        type: 'ShoppingCartOpened.v3',
        data: {
          client: eventV2.data.client,
          shoppingCartId: eventV2.data.shoppingCartId,
          status: ShoppingCartStatus.Opened,
        },
      },
      eventV3,
    ]);
  });
});
