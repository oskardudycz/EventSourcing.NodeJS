import { NextFunction, Request, Response, Router } from 'express';
import { CommandBus } from '#core/commands';
import { sendCreated } from '#core/http';
import { mongoObjectId } from '#core/mongodb';
import { QueryBus } from '#core/queries';
import { OpenShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/openShoppingCart';
import { GetShoppingCartById } from 'src/ecommerce/application/shoppingCarts/queries/getShoppingCartById';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import { AddProductItemToShoppingCartRequest } from 'src/ecommerce/requests/shoppingCarts/addProductItemToShoppingCartRequest';
import { AddProductItemToShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/addProductItemToShoppingCart';
import { ProductItem } from 'src/ecommerce/common/shoppingCarts/productItem';
import { RemoveProductItemFromShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/removeProductItemFromShoppingCart';
import { RemoveProductItemFromShoppingCartRequest } from 'src/ecommerce/requests/shoppingCarts/removeProductItemFromShoppingCartRequest.ts';
import { ConfirmShoppingCart } from 'src/ecommerce/application/shoppingCarts/commands/shoppingCarts/confirmShoppingCart';
import { GetCustomerShoppingHistory } from '../application/shoppingCarts/queries/getCustomerShoppingHistory';

export class ShoppingCartController {
  public router = Router();

  constructor(private commandBus: CommandBus, private queryBus: QueryBus) {
    this.router.post('/customers/:customerId/shopping-carts/', this.open);
    this.router.post(
      '/customers/:customerId/shopping-carts/:shoppingCartId/product-items',
      this.addProductItem
    );
    this.router.delete(
      '/customers/:customerId/shopping-carts/:shoppingCartId/product-items',
      this.removeProductItem
    );
    this.router.post(
      '/customers/:customerId/shopping-carts/:shoppingCartId/confirm',
      this.confirm
    );
    this.router.get(
      '/customers/:customerId/shopping-carts/:shoppingCartId',
      this.getById
    );
    this.router.get(
      '/customers/:customerId/shopping-carts/',
      this.getCustomerShoppingHistory
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
        assertNotEmptyString(request.params.customerId)
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
          assertPositiveNumber(Number(request.query.quantity))
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

  private getCustomerShoppingHistory = async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const query = new GetCustomerShoppingHistory(
        assertNotEmptyString(request.params.customerId)
      );
      const result = await this.queryBus.send(query);

      response.send(result);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
}
