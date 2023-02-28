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
    //renamed property
    cartId: string;
    clientId: string;
  }
>;

describe('Renamed property', () => {
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
        // no translation is made
        shoppingCartId,
        clientId,
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
        map: (value: ShoppingCartOpenedV1): ShoppingCartOpened => {
          return {
            ...value,
            data: {
              ...value.data,
              cartId: value.data.shoppingCartId,
            },
          };
        },
      }
    );

    expect(event).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        cartId: shoppingCartId,
        clientId,
      },
    });
  });

  it('should not be backward compatible with default parse', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();

    const event: ShoppingCartOpened = {
      type: 'ShoppingCartOpened',
      data: {
        cartId: shoppingCartId,
        clientId,
      },
    };
    const json = JSON.stringify(event);

    const oldEvent = JSON.parse(json) as ShoppingCartOpenedV1;

    // JSON parse is not typed,
    // TypeScript is using structural typing, not nominal
    // so data may contain additional data than regular type
    // see also: https://event-driven.io/en/structural_typing_in_type_script/
    expect(oldEvent).not.toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
      },
    });

    expect(oldEvent).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        cartId: shoppingCartId,
        clientId,
      },
    });
  });

  it('should be backward compatible with additional mapper', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();

    const event: ShoppingCartOpened = {
      type: 'ShoppingCartOpened',
      data: {
        cartId: shoppingCartId,
        clientId,
      },
    };
    const json = JSON.stringify(event);

    const oldEvent = JSONParser.parse<
      ShoppingCartOpened,
      ShoppingCartOpened | ShoppingCartOpenedV1
    >(json, {
      map: (
        value: ShoppingCartOpened
      ): ShoppingCartOpened & ShoppingCartOpenedV1 => {
        return {
          ...value,
          data: {
            ...value.data,
            cartId: value.data.cartId,
            shoppingCartId: value.data.cartId,
          },
        };
      },
    });

    expect(oldEvent).not.toEqual({
      type: 'ShoppingCartOpened',
      data: {
        cartId: shoppingCartId,
        clientId,
      },
    });

    expect(oldEvent).not.toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
      },
    });

    expect(oldEvent).toEqual({
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        cartId: shoppingCartId,
        clientId,
      },
    });
  });
});
