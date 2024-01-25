import { Event } from '#core/event';
import { JSONParser } from '#core/jsonParser';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';

export type Client = {
  id: string;
  name: string;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    //new nested property instead of a single field
    client: Client;
  }
>;

const upcast = ({
  data,
}: ShoppingCartOpenedV1 | ShoppingCartOpened): ShoppingCartOpened => {
  const client =
    'client' in data ? data.client : { id: data.clientId, name: 'Unknown' };

  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: data.shoppingCartId,
      client,
    },
  };
};

describe('Upcasting events', () => {
  it('for changed structure should be forward compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();

    const oldEvent: ShoppingCartOpenedV1 = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
      },
    };
    const json = JSONParser.stringify(oldEvent);

    const event = JSONParser.parse<ShoppingCartOpenedV1, ShoppingCartOpened>(
      json,
      {
        map: upcast,
      },
    );

    expect(event).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        client: {
          id: clientId,
          name: 'Unknown',
        },
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
      ShoppingCartOpened
    >(json, {
      map: upcast,
    });

    expect(parsedEvent).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        client: {
          id: clientId,
          name,
        },
      },
    });
  });
});
