import { EventStoreDBClient } from '@eventstore/db-client';
import { type Request, type Response, Router } from 'express';
import { v4 as uuid } from 'uuid';
import { sendCreated } from '../../tools/api';
import { getEventStore } from '../../tools/eventStore';
import {
  assertNotEmptyString,
  assertPositiveNumber,
} from '../../tools/validation';
import {
  addProductItemToShoppingCart,
  cancelShoppingCart,
  confirmShoppingCart,
  openShoppingCart,
  removeProductItemFromShoppingCart,
} from './businessLogic';
import { handleCommand } from './commandHandler';
import {
  type PricedProductItem,
  type ProductItem,
  type ShoppingCart,
  evolve,
} from './shoppingCart';

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

const handle = handleCommand(
  evolve,
  () => ({}) as ShoppingCart,
  mapShoppingCartStreamId,
);

const dummyPriceProvider = (_productId: string) => {
  return 100;
};

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
      async (request: AddProductItemRequest, response: Response) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
        const productItem: ProductItem = {
          productId: assertNotEmptyString(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        };
        const unitPrice = dummyPriceProvider(productItem.productId);

        await handle(eventStore, shoppingCartId, (state) =>
          addProductItemToShoppingCart(
            {
              type: 'AddProductItemToShoppingCart',
              data: {
                shoppingCartId,
                productItem: {
                  ...productItem,
                  unitPrice,
                },
              },
            },
            state,
          ),
        );

        response.sendStatus(204);
      },
    );

    // Remove Product Item
    router.delete(
      '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
      async (request: Request, response: Response) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
        const productItem: PricedProductItem = {
          productId: assertNotEmptyString(request.query.productId),
          quantity: assertPositiveNumber(Number(request.query.quantity)),
          unitPrice: assertPositiveNumber(Number(request.query.unitPrice)),
        };

        await handle(eventStore, shoppingCartId, (state) =>
          removeProductItemFromShoppingCart(
            {
              type: 'RemoveProductItemFromShoppingCart',
              data: {
                shoppingCartId,
                productItem,
              },
            },
            state,
          ),
        );

        response.sendStatus(204);
      },
    );

    // Confirm Shopping Cart
    router.post(
      '/clients/:clientId/shopping-carts/:shoppingCartId/confirm',
      async (request: Request, response: Response) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        await handle(eventStore, shoppingCartId, (state) =>
          confirmShoppingCart(
            {
              type: 'ConfirmShoppingCart',
              data: {
                shoppingCartId,
                now: new Date(),
              },
            },
            state,
          ),
        );

        response.sendStatus(204);
      },
    );

    // Cancel Shopping Cart
    router.delete(
      '/clients/:clientId/shopping-carts/:shoppingCartId',
      async (request: Request, response: Response) => {
        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        await handle(eventStore, shoppingCartId, (state) =>
          cancelShoppingCart(
            {
              type: 'CancelShoppingCart',
              data: {
                shoppingCartId,
                now: new Date(),
              },
            },
            state,
          ),
        );

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
