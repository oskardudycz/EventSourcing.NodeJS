import {
  getExpectedRevisionFromETag,
  sendCreated,
  toWeakETag,
} from '#core/http';
import { getPostgres } from '#core/postgres';
import {
  assertNotEmptyString,
  assertPositiveNumber,
  assertStringOrUndefined,
} from '#core/validation';
import { create, update } from '#eventsourced/core/commandHandling';
import { getEventStore } from '#eventsourced/core/streams';
import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuid } from 'uuid';
import { cartItems, carts } from '../db';
import { getPricedProductItem } from './productItem';
import {
  AddProductItemToShoppingCart,
  addProductItemToShoppingCart,
  ConfirmShoppingCart,
  confirmShoppingCart,
  openShoppingCart,
  removeProductItemFromShoppingCart,
  ShoppingCartEvent,
  toShoppingCartStreamName,
} from './shoppingCart';
import { getUserData } from './user';

//////////////////////////////////////
/// Routes
//////////////////////////////////////

export const router = Router();

// Open Shopping cart
router.post(
  '/v2/shopping-carts/:shoppingCartId?',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId =
        assertStringOrUndefined(request.params.shoppingCartId) ?? uuid();
      const streamName = toShoppingCartStreamName(shoppingCartId);

      const result = await create(getEventStore(), openShoppingCart)(
        streamName,
        {
          shoppingCartId,
        }
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      sendCreated(response, shoppingCartId);
    } catch (error) {
      next(error);
    }
  }
);

// Add Product Item
router.post(
  '/v2/shopping-carts/:shoppingCartId/product-items',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId
      );
      const streamName = toShoppingCartStreamName(shoppingCartId);
      const expectedRevision = getExpectedRevisionFromETag(request);

      const result = await update<
        AddProductItemToShoppingCart,
        ShoppingCartEvent
      >(getEventStore(), (events, command) =>
        addProductItemToShoppingCart(getPricedProductItem, events, command)
      )(
        streamName,
        {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          productItem: {
            productId: assertPositiveNumber(request.body.productId),
            quantity: assertPositiveNumber(request.body.quantity),
          },
        },
        expectedRevision
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
);

// Remove Product Item
router.delete(
  '/v2/shopping-carts/:shoppingCartId/product-items',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId
      );
      const streamName = toShoppingCartStreamName(shoppingCartId);
      const expectedRevision = getExpectedRevisionFromETag(request);

      const result = await update(
        getEventStore(),
        removeProductItemFromShoppingCart
      )(
        streamName,
        {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          productItem: {
            productId: assertPositiveNumber(request.body.productId),
            quantity: assertPositiveNumber(request.body.quantity),
          },
        },
        expectedRevision
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }
);

// Confirm Shopping Cart
router.put(
  '/v2/users/:userId/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCartId = assertNotEmptyString(
        request.params.shoppingCartId
      );
      const streamName = toShoppingCartStreamName(shoppingCartId);
      const expectedRevision = getExpectedRevisionFromETag(request);

      const result = await update<ConfirmShoppingCart, ShoppingCartEvent>(
        getEventStore(),
        (events, command) => confirmShoppingCart(getUserData, events, command)
      )(
        streamName,
        {
          shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
          userId: assertPositiveNumber(request.params.userId),
          additionalInfo: {
            content: assertStringOrUndefined(request.body.content),
            line1: assertStringOrUndefined(request.body.line1),
            line2: assertStringOrUndefined(request.body.line2),
          },
        },
        expectedRevision
      );

      response.set('ETag', toWeakETag(result.nextExpectedRevision));
      response.sendStatus(200);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }
);

router.get(
  '/v2/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const shoppingCarts = carts(getPostgres());
      const shoppingCartItems = cartItems(getPostgres());

      const result = await shoppingCarts.findOne({
        sessionId: assertNotEmptyString(request.params.shoppingCartId),
      });

      if (result === null) {
        response.sendStatus(404);
        return;
      }

      const items = await shoppingCartItems
        .find({
          cartId: result.id,
        })
        .all();

      response.set('ETag', toWeakETag(result.revision));
      response.send({
        ...result,
        items,
      });
    } catch (error) {
      next(error);
    }
  }
);
