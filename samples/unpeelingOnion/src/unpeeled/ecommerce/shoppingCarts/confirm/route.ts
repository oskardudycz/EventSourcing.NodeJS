import { NextFunction, Request, Response, Router } from 'express';
import { assertNotEmptyString } from '#core/validation';
import { confirmShoppingCart } from './handler';
import { ConfirmShoppingCart } from '../shoppingCart';
import { getShoppingCart, store } from '../storage';
import { Collection } from 'mongodb';
import { ShoppingCartModel } from '../storage/';
import { EventBus } from '#core/events';

export const confirmShoppingCartRoute = (
  carts: Collection<ShoppingCartModel>,
  eventBus: EventBus,
  router: Router
) =>
  router.post(
    '/customers/:customerId/shopping-carts/:shoppingCartId/confirm',
    async (
      request: ConfirmShoppingCartRequest,
      response: Response,
      next: NextFunction
    ) => {
      try {
        const command = from(request);
        const cart = await getShoppingCart(carts, command.data.shoppingCartId);

        const event = confirmShoppingCart(command, cart);

        await store(carts, event);
        await eventBus.publish(event);

        response.sendStatus(200);
      } catch (error) {
        console.error(error);
        next(error);
      }
    }
  );

type ConfirmShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

const from = (request: ConfirmShoppingCartRequest): ConfirmShoppingCart => {
  return {
    type: 'confirm-shopping-cart',
    data: {
      shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
    },
  };
};
