import { Request, Response, Router } from 'express';
import {
  assertNotEmptyString,
  assertPositiveNumber,
} from '../../tools/validation';
import { sendCreated } from '../../tools/api';
import { v4 as uuid } from 'uuid';
import { PricedProductItem, ProductItem } from './shoppingCart';

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

export const shoppingCartApi = (router: Router) => {
  // Open Shopping cart
  router.post(
    '/clients/:clientId/shopping-carts/',
    (request: Request, response: Response) => {
      const shoppingCartId = uuid();
      const _clientId = assertNotEmptyString(request.params.clientId);

      // Fill the gap here
      throw new Error('Not Implemented!');

      sendCreated(response, shoppingCartId);
    },
  );

  router.post(
    '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
    (request: AddProductItemRequest, response: Response) => {
      const _shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId,
      );
      const _productItem: ProductItem = {
        productId: assertNotEmptyString(request.body.productId),
        quantity: assertPositiveNumber(request.body.quantity),
      };

      // Fill the gap here
      throw new Error('Not Implemented!');

      response.sendStatus(204);
    },
  );

  // Remove Product Item
  router.delete(
    '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
    (request: Request, response: Response) => {
      const _shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId,
      );
      const _productItem: PricedProductItem = {
        productId: assertNotEmptyString(request.query.productId),
        quantity: assertPositiveNumber(Number(request.query.quantity)),
        unitPrice: assertPositiveNumber(Number(request.query.unitPrice)),
      };

      // Fill the gap here
      throw new Error('Not Implemented!');

      response.sendStatus(204);
    },
  );

  // Confirm Shopping Cart
  router.post(
    '/clients/:clientId/shopping-carts/:shoppingCartId/confirm',
    (request: Request, response: Response) => {
      const _shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId,
      );

      // Fill the gap here
      throw new Error('Not Implemented!');

      response.sendStatus(204);
    },
  );

  // Cancel Shopping Cart
  router.delete(
    '/clients/:clientId/shopping-carts/:shoppingCartId',
    (request: Request, response: Response) => {
      const _shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId,
      );

      // Fill the gap here
      throw new Error('Not Implemented!');

      response.sendStatus(204);
    },
  );
};

// Add Product Item
type AddProductItemRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;
