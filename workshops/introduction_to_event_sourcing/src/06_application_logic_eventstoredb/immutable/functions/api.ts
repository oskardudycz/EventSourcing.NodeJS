import { Request, Response, Router } from 'express';
import {
  assertNotEmptyString,
  assertPositiveNumber,
} from '../../tools/validation';
import { sendCreated } from '../../tools/api';
import { v4 as uuid } from 'uuid';

export const router = Router();

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

// Add Product Item
type AddProductItemRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  (request: AddProductItemRequest, response: Response) => {
    const _shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);
    const _productItem = {
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
    const _shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);
    const _productItem = {
      productId: assertNotEmptyString(request.query.productId),
      quantity: assertPositiveNumber(request.query.quantity),
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
    const _shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    // Fill the gap here
    throw new Error('Not Implemented!');

    response.sendStatus(204);
  },
);

// Cancel Shopping Cart
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  (request: Request, response: Response) => {
    const _shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    // Fill the gap here
    throw new Error('Not Implemented!');

    response.sendStatus(204);
  },
);
