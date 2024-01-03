import { Event } from '#core/events';

export class ShoppingCartOpened extends Event {
  constructor(
    public readonly shoppingCartId: string,
    public readonly customerId: string,
    public readonly openedAt: Date,
  ) {
    super();
  }
}
