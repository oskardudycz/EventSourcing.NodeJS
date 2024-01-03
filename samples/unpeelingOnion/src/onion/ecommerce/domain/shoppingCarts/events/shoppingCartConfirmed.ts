import { Event } from '#core/events';

export class ShoppingCartConfirmed extends Event {
  constructor(
    public readonly shoppingCartId: string,
    public readonly confirmedAt: Date,
  ) {
    super();
  }
}
