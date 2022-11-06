import { NextFunction, Request, Response, Router } from 'express';
import { sendCreated } from '#core/http';
import { mongoObjectId } from '#core/mongodb';
import { QueryBus } from '#core/queries';
import { GetShoppingCartById } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getShoppingCartById';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import { AddProductItemToShoppingCartRequest } from 'src/unpeeled/ecommerce/shoppingCarts/requests/addProductItemToShoppingCartRequest';
import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/common/productItem';
import { RemoveProductItemFromShoppingCartRequest } from 'src/unpeeled/ecommerce/shoppingCarts/requests/removeProductItemFromShoppingCartRequest.ts';
import { GetCustomerShoppingHistory } from 'src/unpeeled/ecommerce/shoppingCarts/application/queries/getCustomerShoppingHistory';
import { ShoppingCart } from 'src/unpeeled/ecommerce/shoppingCarts';
import { EventBus } from '#core/events';
import { ShoppingCartModel } from '../models/shoppingCart';
import { ShoppingCartMapper } from '../application/mappers/shoppingCartMapper';
import { Collection, MongoClient } from 'mongodb';
import {
  OpenShoppingCart,
  AddProductItemToShoppingCart,
  RemoveProductItemFromShoppingCart,
  ConfirmShoppingCart,
} from '../commands';
import { getCollection, getById } from '#core/repositories';
import { store } from '../infrastructure/shoppingCartRepository';

export class ShoppingCartController {
  public router = Router();
  private carts: Collection<ShoppingCartModel>;

  constructor(
    mongo: MongoClient,
    private mapper: ShoppingCartMapper,
    private eventBus: EventBus,
    private queryBus: QueryBus
  ) {
    this.carts = getCollection<ShoppingCartModel>(mongo, 'shoppingCarts');
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
      const command: OpenShoppingCart = {
        type: 'open-shopping-cart',
        data: {
          shoppingCartId: mongoObjectId(),
          customerId: assertNotEmptyString(request.params.customerId),
        },
      };

      const event = ShoppingCart.open(
        command.data.shoppingCartId,
        command.data.customerId
      );

      await store(this.carts, event);
      await this.eventBus.publish(event);

      sendCreated(response, command.data.shoppingCartId);
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
      const command: AddProductItemToShoppingCart = {
        type: 'add-product-item-to-shopping-cart',
        data: {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          productItem: new ProductItem(
            assertNotEmptyString(request.body.productId),
            assertPositiveNumber(request.body.quantity)
          ),
        },
      };
      const model = await getById(this.carts, command.data.shoppingCartId);

      const aggregate = this.mapper.toAggregate(model);
      const event = aggregate.addProductItem(command.data.productItem);

      await store(this.carts, event, model);
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
      const command: RemoveProductItemFromShoppingCart = {
        type: 'remove-product-item-from-shopping-cart',
        data: {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          productItem: new ProductItem(
            assertNotEmptyString(request.query.productId),
            assertPositiveNumber(Number(request.query.quantity))
          ),
        },
      };
      const model = await getById(this.carts, command.data.shoppingCartId);

      const aggregate = this.mapper.toAggregate(model);
      const event = aggregate.removeProductItem(command.data.productItem);

      await store(this.carts, event, model);
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
      const command: ConfirmShoppingCart = {
        type: 'confirm-shopping-cart',
        data: {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
        },
      };
      const model = await getById(this.carts, command.data.shoppingCartId);

      const aggregate = this.mapper.toAggregate(model);
      const event = aggregate.confirm();

      await store(this.carts, event, model);
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
