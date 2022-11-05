import { NextFunction, Request, Response, Router } from 'express';
import { CommandBus } from '#core/commands';
import { sendCreated } from '#core/http';
import OpenShoppingCart from '../domain/commands/shoppingCarts/openShoppingCart';
import { mongoObjectId } from '#core/mongodb';
import { QueryBus } from '#core/queries';
import GetShoppingCartById from '../domain/queries/getShoppingCartById';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import { AddProductItemToShoppingCartRequest } from '../requests/shoppingCarts/addProductItemToShoppingCartRequest';
import AddProductItemToShoppingCart from '../domain/commands/shoppingCarts/addProductItemToShoppingCart';
import { ProductItem } from '../models/shoppingCarts/productItem';
import RemoveProductItemFromShoppingCart from '../domain/commands/shoppingCarts/removeProductItemFromShoppingCart';
import { RemoveProductItemFromShoppingCartRequest } from '../requests/shoppingCarts/removeProductItemFromShoppingCartRequest.ts';
import ConfirmShoppingCart from '../domain/commands/shoppingCarts/confirmShoppingCart';

class ShoppingCartController {
  public router = Router();

  constructor(private commandBus: CommandBus, private queryBus: QueryBus) {
    this.router.post('/:clientId/shopping-carts/', this.open);
    this.router.get('/:clientId/shopping-carts/:shoppingCartId', this.getById);
    this.router.post(
      '/:clientId/shopping-carts/:shoppingCartId/product-items',
      this.addProductItem
    );
    this.router.delete(
      '/:clientId/shopping-carts/:shoppingCartId/product-items',
      this.removeProductItem
    );
    this.router.post(
      '/:clientId/shopping-carts/:shoppingCartId/confirm',
      this.confirm
    );
  }

  private open = async (
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

  private addProductItem = async (
    request: AddProductItemToShoppingCartRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const command = new AddProductItemToShoppingCart(
        assertNotEmptyString(request.params.shoppingCartId),
        new ProductItem(
          assertNotEmptyString(request.body.productId),
          assertPositiveNumber(request.body.quantity)
        )
      );
      await this.commandBus.send(command);

      response.sendStatus(200);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };

  private removeProductItem = async (
    request: RemoveProductItemFromShoppingCartRequest,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const command = new RemoveProductItemFromShoppingCart(
        assertNotEmptyString(request.params.shoppingCartId),
        new ProductItem(
          assertNotEmptyString(request.query.productId),
          assertPositiveNumber(request.query.quantity)
        )
      );
      await this.commandBus.send(command);

      response.sendStatus(200);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };

  private confirm = async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const command = new ConfirmShoppingCart(
        assertNotEmptyString(request.params.shoppingCartId)
      );
      await this.commandBus.send(command);

      response.sendStatus(200);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };

  private getById = async (
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
