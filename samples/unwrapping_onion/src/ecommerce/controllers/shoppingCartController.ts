import { NextFunction, Request, Response, Router } from 'express';
import { CommandBus } from '#core/commands';
import { sendCreated } from '#core/http';
import OpenShoppingCart from '../domain/commands/shoppingCarts/openShoppingCart';
import { mongoObjectId } from '#core/mongodb';
import { QueryBus } from '#core/queries';
import GetShoppingCartById from '../domain/queries/getShoppingCartById';
import { assertNotEmptyString } from '#core/validation';
import { AddProductItemRequest } from '../requests/shoppingCarts/addProductItemRequest';

class ShoppingCartController {
  public router = Router();

  constructor(private commandBus: CommandBus, private queryBus: QueryBus) {
    this.router.post('/:clientId/shopping-carts/', this.open);
    this.router.get('/:clientId/shopping-carts/:shoppingCartId', this.getById);
    this.router.post(
      '/:clientId/shopping-carts/:shoppingCartId/product-items',
      this.addProductItem
    );
  }

  public open = async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const command = new OpenShoppingCart(
        mongoObjectId(),
        assertNotEmptyString(request.params.clientId)
      );
      await this.commandBus.send(command);

      sendCreated(response, command.shoppingCartId);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };

  public addProductItem = async (
    request: AddProductItemRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const command = new OpenShoppingCart(
        mongoObjectId(),
        assertNotEmptyString(request.params.clientId)
      );
      await this.commandBus.send(command);

      sendCreated(response, command.shoppingCartId);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };

  public getById = async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const query = new GetShoppingCartById(
        assertNotEmptyString(request.params.shoppingCartId)
      );
      const result = await this.queryBus.send(query);

      response.send(result);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
}

export default ShoppingCartController;
