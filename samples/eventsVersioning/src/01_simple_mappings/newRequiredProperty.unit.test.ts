import { Event } from '#core/event';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';
import { JSONParser } from '#core/jsonParser';

enum ShoppingCartStatus {
  Pending = 'Pending',
  Opened = 'Opened',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    // Adding new required property as nullable
    status: ShoppingCartStatus;
  }
>;

describe('New required property', () => {
  it('default JSON.parse should not be forward compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();

    const oldEvent: ShoppingCartOpenedV1 = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
      },
    };
    const json = JSON.stringify(oldEvent);

    const event = JSON.parse(json) as ShoppingCartOpened;

    expect(event).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        // no default value for status
      },
    });
  });

  it('JSON.parse with additional mapper should be forward compatible', () => {
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
        map: (value: ShoppingCartOpened): ShoppingCartOpened => {
          return {
            ...value,
            data: {
              ...value.data,
              status: value.data.status ?? ShoppingCartStatus.Opened,
            },
          };
        },
      },
    );

    expect(event).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        status: ShoppingCartStatus.Opened,
      },
    });
  });

  it('should be backward compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();

    const event: ShoppingCartOpened = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        status: ShoppingCartStatus.Opened,
      },
    };
    const json = JSON.stringify(event);

    const oldEvent = JSON.parse(json) as ShoppingCartOpenedV1;

    // JSON parse is not typed,
    // TypeScript is using structural typing, not nominal
    // so data may contain additional data than regular type
    // see also: https://event-driven.io/en/structural_typing_in_type_script/
    expect(oldEvent).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        status: ShoppingCartStatus.Opened,
      },
    });
  });
});
