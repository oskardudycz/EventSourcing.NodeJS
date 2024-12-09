import { Request, Response, Router } from 'express';
import {
  assertNotEmptyString,
  assertPositiveNumber,
} from '../../tools/validation';
import { sendCreated } from '../../tools/api';
import { v4 as uuid } from 'uuid';
import { PricedProductItem, ProductItem } from './shoppingCart';
import { decider } from './businessLogic';
import { CommandHandler } from './commandHandler';
import { EventStoreDBClient } from '@eventstore/db-client';
import { getEventStore } from '../../tools/eventStore';
import { getETagFromIfMatch, getWeakETagValue } from '../../tools/etag';

export const mapShoppingCartStreamId = (id: string) => `shopping_cart-${id}`;

export const handle = CommandHandler(decider, mapShoppingCartStreamId);

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

        await handle(eventStore, shoppingCartId, {
          type: 'OpenShoppingCart',
          data: { clientId, shoppingCartId, now: new Date() },
        });

        // Get the next expected revision after appending events from business logic
        // setETag(response, nextEtag);
        sendCreated(response, shoppingCartId);
      },
    );

    router.post(
      '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
      async (request: AddProductItemRequest, response: Response) => {
        const eTag = getETagFromIfMatch(request);
        // Use this to ensure that there's no conflicting update
        const _weakEtag = getWeakETagValue(eTag);

        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
        const productItem: ProductItem = {
          productId: assertNotEmptyString(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        };
        const unitPrice = dummyPriceProvider(productItem.productId);

        await handle(eventStore, shoppingCartId, {
          type: 'AddProductItemToShoppingCart',
          data: { shoppingCartId, productItem: { ...productItem, unitPrice } },
        });

        // Get the next expected revision after appending events from business logic
        // setETag(response, nextEtag);
        response.sendStatus(204);
      },
    );

    // Remove Product Item
    router.delete(
      '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
      async (request: Request, response: Response) => {
        const eTag = getETagFromIfMatch(request);
        // Use this to ensure that there's no conflicting update
        const _weakEtag = getWeakETagValue(eTag);

        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );
        const productItem: PricedProductItem = {
          productId: assertNotEmptyString(request.query.productId),
          quantity: assertPositiveNumber(Number(request.query.quantity)),
          unitPrice: assertPositiveNumber(Number(request.query.unitPrice)),
        };

        await handle(eventStore, shoppingCartId, {
          type: 'RemoveProductItemFromShoppingCart',
          data: { shoppingCartId, productItem },
        });

        // Get the next expected revision after appending events from business logic
        // setETag(response, nextEtag);
        response.sendStatus(204);
      },
    );

    // Confirm Shopping Cart
    router.post(
      '/clients/:clientId/shopping-carts/:shoppingCartId/confirm',
      async (request: Request, response: Response) => {
        const eTag = getETagFromIfMatch(request);
        // Use this to ensure that there's no conflicting update
        const _weakEtag = getWeakETagValue(eTag);

        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        await handle(eventStore, shoppingCartId, {
          type: 'ConfirmShoppingCart',
          data: { shoppingCartId, now: new Date() },
        });

        // Get the next expected revision after appending events from business logic
        // setETag(response, nextEtag);
        response.sendStatus(204);
      },
    );

    // Cancel Shopping Cart
    router.delete(
      '/clients/:clientId/shopping-carts/:shoppingCartId',
      async (request: Request, response: Response) => {
        const eTag = getETagFromIfMatch(request);
        // Use this to ensure that there's no conflicting update
        const _weakEtag = getWeakETagValue(eTag);

        const shoppingCartId = assertNotEmptyString(
          request.params.shoppingCartId,
        );

        await handle(eventStore, shoppingCartId, {
          type: 'CancelShoppingCart',
          data: { shoppingCartId, now: new Date() },
        });

        // Get the next expected revision after appending events from business logic
        // setETag(response, nextEtag);
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
