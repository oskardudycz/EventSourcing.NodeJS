import { Command } from '#core/commands';

export class ConfirmShoppingCart extends Command {
  constructor(public readonly shoppingCartId: string) {
    super();
  }
}
