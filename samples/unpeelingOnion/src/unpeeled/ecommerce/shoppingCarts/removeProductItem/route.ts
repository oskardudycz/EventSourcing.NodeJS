import { NextFunction, Request, Response, Router } from 'express';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import { removeProductItemFromShoppingCart } from './handler';
import { RemoveProductItemFromShoppingCart } from '../shoppingCart';
import { getShoppingCart, store } from '../storage';
import { Collection } from 'mongodb';
import { ShoppingCartModel } from '../storage/';
import { EventBus } from '#core/events';

export const removeProductItemFromShoppingCartRoute = (
  carts: Collection<ShoppingCartModel>,
  eventBus: EventBus,
  router: Router
) =>
  router.delete(
    '/customers/:customerId/shopping-carts/:shoppingCartId/product-items',
    async (
      request: RemoveProductItemFromShoppingCartRequest,
      response: Response,
      next: NextFunction
    ) => {
      try {
        const command = from(request);
        const cart = await getShoppingCart(carts, command.data.shoppingCartId);

        const event = removeProductItemFromShoppingCart(command, cart);

        await store(carts, event);
        await eventBus.publish(event);

        response.sendStatus(200);
      } catch (error) {
        console.error(error);
        next(error);
      }
    }
  );

export type RemoveProductItemFromShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

const from = (
  request: RemoveProductItemFromShoppingCartRequest
): RemoveProductItemFromShoppingCart => {
  return {
    type: 'remove-product-item-from-shopping-cart',
    data: {
      shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
      productItem: {
        productId: assertNotEmptyString(request.query.productId),
        quantity: assertPositiveNumber(Number(request.query.quantity)),
      },
    },
  };
};
