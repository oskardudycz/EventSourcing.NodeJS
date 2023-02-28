import { Event } from '#core/event';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';
import { JSONParser } from '#core/jsonParser';

export type EventMetadata = {
  userId: string;
};

export type EventWithMetadata<E extends Event> = E & {
  metadata: EventMetadata;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    //renamed property
    shoppingCartId: string;
    clientId: string;
    initializedBy: string;
  }
>;

const upcast = ({
  data,
  metadata: { userId },
}: EventWithMetadata<
  ShoppingCartOpenedV1 | ShoppingCartOpened
>): ShoppingCartOpened => {
  const initializedBy = 'initializedBy' in data ? data.initializedBy : userId;
  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: data.shoppingCartId,
      clientId: data.clientId,
      initializedBy,
    },
  };
};

describe('Upcasting events', () => {
  it('for new required property from metadata should be forward compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();
    const userId = uuid();

    const oldEvent: EventWithMetadata<ShoppingCartOpenedV1> = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
      },
      metadata: { userId },
    };
    const json = JSONParser.stringify(oldEvent);

    const event = JSONParser.parse<
      EventWithMetadata<ShoppingCartOpenedV1>,
      ShoppingCartOpened
    >(json, {
      map: upcast,
    });

    expect(event).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        initializedBy: userId,
      },
    });
  });

  it('for new structure should be compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();
    const initializedBy = uuid();
    const userId = uuid();

    const event: EventWithMetadata<ShoppingCartOpened> = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        initializedBy,
      },
      metadata: { userId },
    };
    const json = JSONParser.stringify(event);

    const parsedEvent = JSONParser.parse<
      EventWithMetadata<ShoppingCartOpened | ShoppingCartOpenedV1>,
      ShoppingCartOpened
    >(json, {
      map: upcast,
    });

    expect(parsedEvent).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        initializedBy,
      },
    });
  });
});
