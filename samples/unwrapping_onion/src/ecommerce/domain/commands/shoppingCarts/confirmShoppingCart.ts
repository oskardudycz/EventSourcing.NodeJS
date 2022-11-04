import { Command } from '#core/commands';

export default class ConfirmShoppingCart extends Command {
  constructor(public readonly shoppingCartId: string) {
    super();
  }
}
