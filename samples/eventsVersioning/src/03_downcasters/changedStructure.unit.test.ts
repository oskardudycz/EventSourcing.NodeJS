import { Event } from '#core/event';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';
import { JSONParser } from '#core/jsonParser';

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

const downcast = ({
  data,
}: ShoppingCartOpened): ShoppingCartOpenedV1 & ShoppingCartOpened => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      ...data,
      clientId: data.client.id,
    },
  };
};

describe('Downcasting events', () => {
  it('for changed structure should be backward compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();
    const name = 'Test';

    const oldEvent: ShoppingCartOpened = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        client: {
          id: clientId,
          name,
        },
      },
    };
    const json = JSONParser.stringify(oldEvent);

    const event = JSONParser.parse<
      ShoppingCartOpenedV1,
      ShoppingCartOpened & ShoppingCartOpenedV1
    >(json, {
      map: downcast,
    });

    expect(event).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        client: {
          id: clientId,
          name,
        },
        clientId,
      },
    });
  });

  it('for new structure should be compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();
    const name = 'Test';

    const event: ShoppingCartOpened = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        client: { id: clientId, name },
      },
    };
    const json = JSONParser.stringify(event);

    const parsedEvent = JSONParser.parse<
      ShoppingCartOpened | ShoppingCartOpenedV1,
      ShoppingCartOpened & ShoppingCartOpenedV1
    >(json, {
      map: downcast,
    });

    expect(parsedEvent).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        client: {
          id: clientId,
          name,
        },
      },
    });
  });
});
