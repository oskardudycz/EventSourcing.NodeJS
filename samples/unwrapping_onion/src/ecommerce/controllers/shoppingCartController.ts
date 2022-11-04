import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuid } from 'uuid';
import { CommandBus } from '#core/commands';
import { sendCreated } from '#core/http';
import OpenShoppingCart from '../domain/commands/shoppingCarts/openShoppingCart';
import { mongoObjectId } from '#core/mongodb';

class ShoppingCartController {
  public router = Router();

  constructor(private commandBus: CommandBus) {
    this.router.post('/:clientId/shopping-carts/:shoppingCartId?', this.open);
  }

  public open = async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const command = new OpenShoppingCart(mongoObjectId(), uuid());
      await this.commandBus.send(command);

      sendCreated(response, command.shoppingCartId);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
}

export default ShoppingCartController;
