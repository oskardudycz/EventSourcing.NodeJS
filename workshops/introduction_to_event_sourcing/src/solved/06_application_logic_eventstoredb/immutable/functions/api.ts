import { Request, Response, Router } from 'express';
import {
  assertNotEmptyString,
  assertPositiveNumber,
} from '../../tools/validation';
import { sendCreated } from '../../tools/api';
import { getEventStore } from '../../tools/eventStore';
import { v4 as uuid } from 'uuid';
import { handleCommand } from './commandHandler';
import { ShoppingCart, evolve } from './shoppingCart';
import { EventStoreDBClient } from '@eventstore/db-client';
import { openShoppingCart } from './businessLogic';

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

const handle = handleCommand(
  evolve,
  () => ({}) as ShoppingCart,
  mapShoppingCartStreamId,
);

export const shoppingCartApi =
  (eventStoreDB: EventStoreDBClient) => (router: Router) => {
    const eventStore = getEventStore(eventStoreDB);

    // Open Shopping cart
    router.post(
      '/clients/:clientId/shopping-carts/',
      async (request: Request, response: Response) => {
        const shoppingCartId = uuid();
        const clientId = assertNotEmptyString(request.params.clientId);

        await handle(eventStore, shoppingCartId, (_) =>
          openShoppingCart({
            type: 'OpenShoppingCart',
            data: { clientId, shoppingCartId, now: new Date() },
          }),
        );

        sendCreated(response, shoppingCartId);
      },
    );

    router.post(
      '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
      (request: AddProductItemRequest, response: Response) => {
        const _shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
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
        const _shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
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
