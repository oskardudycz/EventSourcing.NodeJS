import { Event } from '#core/event';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';
import { JSONParser } from '#core/jsonParser';

export type Client = {
  id: string;
  name: string;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened.v2',
  {
    //renamed property
    shoppingCartId: string;
    client: Client;
  }
>;

enum ShoppingCartStatus {
  Pending = 'Pending',
  Opened = 'Opened',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCartOpenedWithStatus = Event<
  'ShoppingCartOpened.v3',
  {
    shoppingCartId: string;
    client: Client;
    // Adding new required property as nullable
    status: ShoppingCartStatus;
  }
>;

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

export type StoredEvent = {
  type: string;
  payload: string;
};

export class EventParser {
  constructor(private eventTransformations: EventTransformations) {}

  public parse<E extends Event = Event>({ type, payload }: StoredEvent) {
    const upcaster = this.eventTransformations.get.upcaster(type);

    const result = JSONParser.parse(payload, upcaster ? { map: upcaster } : {});

    return result as E;
  }

  public stringify<E extends Event = Event>(event: E): StoredEvent {
    const downcaster = this.eventTransformations.get.downcaster(event.type);

    return {
      type: event.type,
      payload: JSONParser.stringify(
        event,
        downcaster ? { map: downcaster } : {},
      ),
    };
  }
}

describe('Multiple transformations with different event types', () => {
  it('upcast should be forward compatible', () => {
    const eventTransformations = new EventTransformations();
    eventTransformations.register
      .upcaster('ShoppingCartOpened', upcastShoppingCartOpened)
      .upcaster('ShoppingCartOpened.v2', upcastShoppingCartOpened)
      .downcaster('ShoppingCartOpened.v3', downcastShoppingCartOpened);

    const parser = new EventParser(eventTransformations);

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

    const events = [eventV1, eventV2, eventV3];

    // Given
    const serializedEvents = events.map((e) => {
      return {
        type: e.type,
        payload: JSON.stringify(e),
      };
    });

    // When
    const deserializedEvents = serializedEvents.map((e) =>
      parser.parse<ShoppingCartOpenedWithStatus>(e),
    );

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
