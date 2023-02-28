import { Event } from '#core/event';
import { ShoppingCartOpened as ShoppingCartOpenedV1 } from 'src/events/events.v1';
import { v4 as uuid } from 'uuid';

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    // Adding new not required property as nullable
    openedAt?: string;
  }
>;

describe('New not required property', () => {
  it('should be forward compatible', () => {
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
      },
    });
  });

  it('should be backward compatible', () => {
    const shoppingCartId = uuid();
    const clientId = uuid();
    const openedAt = new Date().toISOString();

    const event: ShoppingCartOpened = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        clientId,
        openedAt,
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
        openedAt,
      },
    });
  });
});
