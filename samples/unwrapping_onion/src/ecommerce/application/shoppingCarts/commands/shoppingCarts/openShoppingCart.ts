import { Command } from '#core/commands';

export default class OpenShoppingCart extends Command {
  constructor(
    public readonly shoppingCartId: string,
    public readonly clientId: string
  ) {
    super();
  }
}
