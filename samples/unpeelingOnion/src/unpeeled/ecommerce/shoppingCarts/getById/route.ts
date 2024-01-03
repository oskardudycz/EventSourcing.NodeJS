import { NextFunction, Request, Response, Router } from 'express';
import { assertNotEmptyString } from '#core/validation';
import { Collection } from 'mongodb';
import { ShoppingCartModel } from '../storage/';
import { getById } from '#core/mongo';

export const getShoppingCartByIdRoute = (
  carts: Collection<ShoppingCartModel>,
  router: Router,
) =>
  router.get(
    '/customers/:customerId/shopping-carts/:shoppingCartId/',
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const result = await getById(
          carts,
          assertNotEmptyString(request.params.shoppingCartId),
        );

        response.send(result);
      } catch (error) {
        console.error(error);
        next(error);
      }
    },
  );
