import { NextFunction, Request, Response, Router } from 'express';
import { CommandBus } from '#core/commands';
import { sendCreated } from '#core/http';
import { mongoObjectId } from '#core/mongodb';
import { QueryBus } from '#core/queries';
import { OpenShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/openShoppingCart';
import { GetShoppingCartById } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getShoppingCartById';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import { AddProductItemToShoppingCartRequest } from 'src/unpeeled/ecommerce/shoppingCarts/requests/addProductItemToShoppingCartRequest';
import { AddProductItemToShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/addProductItemToShoppingCart';
import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/common/productItem';
import { RemoveProductItemFromShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/removeProductItemFromShoppingCart';
import { RemoveProductItemFromShoppingCartRequest } from 'src/unpeeled/ecommerce/shoppingCarts/requests/removeProductItemFromShoppingCartRequest.ts';
import { ConfirmShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts/application/commands/shoppingCarts/confirmShoppingCart';
import { GetCustomerShoppingHistory } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getCustomerShoppingHistory';
import { ShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts';
import { ShoppingCartRepository } from '../infrastructure/shoppingCartRepository';
import { EventBus } from '#core/events';
import { ShoppingCartModel } from '../models/shoppingCart';
import { ShoppingCartMapper } from '../application/mappers/shoppingCartMapper';
export class ShoppingCartController {
  public router = Router();

  constructor(
    private repository: ShoppingCartRepository,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus,
    private queryBus: QueryBus
  ) {
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
      const event = ShoppingCart.open(
        command.shoppingCartId,
        command.customerId
      );

      await this.repository.store({} as ShoppingCartModel, event);

      await this.eventBus.publish(event);

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
      const model = await this.repository.find(command.shoppingCartId);

      if (model === null) {
        throw Error(
          `Shopping cart with id ${command.shoppingCartId} not found!`
        );
      }

      const aggregate = this.mapper.toAggregate(model);
      const event = aggregate.addProductItem(command.productItem);

      await this.repository.store(model, event);

      await this.eventBus.publish(event);

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
      const model = await this.repository.find(command.shoppingCartId);

      if (model === null) {
        throw Error(
          `Shopping cart with id ${command.shoppingCartId} not found!`
        );
      }

      const aggregate = this.mapper.toAggregate(model);
      const event = aggregate.removeProductItem(command.productItem);

      await this.repository.store(model, event);

      await this.eventBus.publish(event);

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
      const model = await this.repository.find(command.shoppingCartId);

      if (model === null) {
        throw Error(
          `Shopping cart with id ${command.shoppingCartId} not found!`
        );
      }

      const aggregate = this.mapper.toAggregate(model);
      const event = aggregate.confirm();

      await this.repository.store(model, event);

      await this.eventBus.publish(event);

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
      const result = await this.queryBus.query(query);

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
      const result = await this.queryBus.query(query);

      response.send(result);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
}
