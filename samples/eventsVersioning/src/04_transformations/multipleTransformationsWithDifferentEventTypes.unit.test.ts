import { Event } from '#core/event';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';
import { JSONParser, Mapper, MapperArgs } from '#core/jsonParser';

export type Client = {
  id: string;
  name: string;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
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
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    client: Client;
    // Adding new required property as nullable
    status: ShoppingCartStatus;
  }
>;

export type ShoppingCartOpenedAllVersions =
  | ShoppingCartOpenedV1
  | ShoppingCartOpened
  | ShoppingCartOpenedWithStatus;

export const upcastV1 = ({
  data,
}: ShoppingCartOpenedV1): ShoppingCartOpenedWithStatus => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: data.shoppingCartId,
      client: { id: data.clientId, name: 'Unknown' },
      status: ShoppingCartStatus.Opened,
    },
  };
};

export const upcastV2 = ({
  data,
}: ShoppingCartOpened): ShoppingCartOpenedWithStatus => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      ...data,
      status: ShoppingCartStatus.Opened,
    },
  };
};

export type EventTypeName = string | { version: string; name: string };

export class EventTypeMapping {
  #fromMappings = new Map<string, string>();
  #toMappings = new Map<string, EventTypeName>();

  public register = {
    from: (...fromTypes: EventTypeName[]) => {
      return {
        to: (to: string) => {
          for (const from of fromTypes) {
            this.#fromMappings.set(EventTypeParser.stringify(from), to);
          }
          this.#toMappings.set(to, fromTypes[fromTypes.length - 1]);
        },
      };
    },
  };

  public map = {
    from: (from: EventTypeName): string | undefined =>
      this.#fromMappings.get(EventTypeParser.stringify(from)),
    to: (to: string): EventTypeName | undefined => this.#toMappings.get(to),
  };
}

export const EventTypeParser = {
  parse: (eventTypeName: string): EventTypeName => {
    if (eventTypeName.indexOf('__') === -1) return eventTypeName;

    const [version, name] = eventTypeName.split('__');

    return { version, name };
  },
  stringify: (eventTypeName: EventTypeName) => {
    return typeof eventTypeName === 'string'
      ? eventTypeName
      : `${eventTypeName.version}__${eventTypeName.name}`;
  },
};

export class EventTransformations {
  #upcasters = new Map<string, (event: Event) => Event>();
  #downcasters = new Map<string, (event: Event) => Event>();

  public register = {
    upcaster: <From extends Event, To extends Event = From>(
      typeName: EventTypeName,
      upcaster: Mapper<From, To>
    ) => {
      this.#upcasters.set(EventTypeParser.stringify(typeName), (event) =>
        upcaster(event as MapperArgs<From, To>)
      );

      return this.register;
    },
    downcaster: <From extends Event, To extends Event = From>(
      typeName: EventTypeName,
      upcaster: Mapper<From, To>
    ) => {
      this.#downcasters.set(EventTypeParser.stringify(typeName), (event) =>
        upcaster(event as MapperArgs<From, To>)
      );

      return this.register;
    },
  };

  public tryUpcast = <From extends Event = Event, To extends Event = From>(
    typeName: EventTypeName,
    event: Event
  ): To | null => {
    const eventTypeName = EventTypeParser.stringify(typeName);

    const upcast = this.#upcasters.get(eventTypeName);

    return upcast ? (upcast(event) as To) : null;
  };

  public tryDowncast = <From extends Event = Event, To extends Event = From>(
    typeName: EventTypeName,
    event: Event
  ): To | null => {
    const eventTypeName = EventTypeParser.stringify(typeName);

    const downcast = this.#downcasters.get(eventTypeName);

    return downcast ? (downcast(event) as To) : null;
  };
}

export type StoredEvent = {
  type: string;
  payload: string;
};

export class EventParser {
  constructor(
    private eventTypeMapping: EventTypeMapping,
    private eventTransformations: EventTransformations
  ) {}

  public parse<E extends Event = Event>(storedEvent: StoredEvent) {
    const eventType = EventTypeParser.parse(storedEvent.type);

    const upcastResult = this.eventTransformations.tryUpcast<E>(
      storedEvent.type
    );
  }

  public stringify(storedEvent: StoredEvent): StoredEvent {}
}
