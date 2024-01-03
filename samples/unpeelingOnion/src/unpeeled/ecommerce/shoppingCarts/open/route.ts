import { NextFunction, Request, Response, Router } from 'express';
import { mongoObjectId } from '#core/mongodb';
import { assertNotEmptyString } from '#core/validation';
import { openShoppingCart } from './handler';
import { OpenShoppingCart } from '../shoppingCart';
import { sendCreated } from '#core/http';
import { store } from '../storage';
import { Collection } from 'mongodb';
import { ShoppingCartModel } from '../storage/';
import { EventBus } from '#core/events';

export const openShoppingCartRoute = (
  carts: Collection<ShoppingCartModel>,
  eventBus: EventBus,
  router: Router,
) =>
  router.post(
    '/customers/:customerId/shopping-carts/',
    async (
      request: OpenShoppingCartRequest,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const command: OpenShoppingCart = {
          type: 'open-shopping-cart',
          data: {
            shoppingCartId: mongoObjectId(),
            customerId: assertNotEmptyString(request.params.customerId),
          },
        };

        const event = openShoppingCart(command);

        await store(carts, event);
        await eventBus.publish(event);

        sendCreated(response, command.data.shoppingCartId);
      } catch (error) {
        console.error(error);
        next(error);
      }
    },
  );

type OpenShoppingCartRequest = Request<Partial<{ customerId: string }>>;
