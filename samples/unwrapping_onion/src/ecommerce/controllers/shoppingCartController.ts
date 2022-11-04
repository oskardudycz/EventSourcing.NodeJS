import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuid } from 'uuid';
import CommandBus from '#core/commands';
import { sendCreated } from '#core/http';
import OpenShoppingCart from '../domain/commands/shoppingCarts/openShoppingCart';

class ShoppingCartController {
  public router = Router();

  constructor(private commandBus: CommandBus) {
    this.router.post('/:clientId/shopping-carts/:shoppingCartId?', this.open);
  }

  public open = async (
    request: Request,
    response: Response,
    _next: NextFunction
  ) => {
    const command = new OpenShoppingCart(uuid(), uuid());
    await this.commandBus.send(command);

    sendCreated(response, command.shoppingCartId);
  };
}

export default ShoppingCartController;
