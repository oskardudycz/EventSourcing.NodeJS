import { Command } from '#core/commands';

export class OpenShoppingCart extends Command {
  constructor(
    public readonly shoppingCartId: string,
    public readonly customerId: string
  ) {
    super();
  }
}
