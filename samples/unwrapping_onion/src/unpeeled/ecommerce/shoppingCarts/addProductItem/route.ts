import { NextFunction, Request, Response, Router } from 'express';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import { AddProductItemToShoppingCart } from '../shoppingCart';
import { getShoppingCart, store } from '../storage';
import { Collection } from 'mongodb';
import { ShoppingCartModel } from '../storage/';
import { EventBus } from '#core/events';
import { addProductItemToShoppingCart } from './handler';

export const addProductItemToShoppingCartRoute = (
  carts: Collection<ShoppingCartModel>,
  eventBus: EventBus,
  router: Router
) =>
  router.post(
    '/customers/:customerId/shopping-carts/:shoppingCartId/product-items',
    async (
      request: AddProductItemToShoppingCartRequest,
      response: Response,
      next: NextFunction
    ) => {
      try {
        const command = from(request);
        const cart = await getShoppingCart(carts, command.data.shoppingCartId);

        const event = addProductItemToShoppingCart(from(request), cart);

        await store(carts, event);
        await eventBus.publish(event);

        response.sendStatus(200);
      } catch (error) {
        console.error(error);
        next(error);
      }
    }
  );

export type AddProductItemToShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

const from = (
  request: AddProductItemToShoppingCartRequest
): AddProductItemToShoppingCart => {
  return {
    type: 'add-product-item-to-shopping-cart',
    data: {
      shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
      productItem: {
        productId: assertNotEmptyString(request.body.productId),
        quantity: assertPositiveNumber(request.body.quantity),
      },
    },
  };
};
