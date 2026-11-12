import type { NextFunction, Request, Response, Router } from 'express';
import { assertNotEmptyString } from '#core/validation';
import type { Collection } from 'mongodb';
import type { ShoppingCartModel } from '../storage/';
import type { GetCustomerShoppingHistory } from './handler';
import { findAllByCustomerId } from './handler';

export const getCustomerShoppingHistoryRoute = (
  carts: Collection<ShoppingCartModel>,
  router: Router,
) =>
  router.get(
    '/customers/:customerId/shopping-carts/',
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const query = from(request);
        const result = await findAllByCustomerId(carts, query);

        response.send(result);
      } catch (error) {
        console.error(error);
        next(error);
      }
    },
  );

const from = (request: Request): GetCustomerShoppingHistory => {
  return {
    customerId: assertNotEmptyString(request.params.customerId),
  };
};
