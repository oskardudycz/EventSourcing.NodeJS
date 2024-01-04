import { NextFunction, Request, Response, Router } from 'express';
import { CommandHandler } from '#core/commandHandling';
import { HTTPHandler } from '#core/http';
import { getEventStore } from '#core/streams';
import { assertNotEmptyString, assertPositiveNumber } from '#core/validation';
import {
  decider,
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent,
  toShoppingCartStreamId,
} from './shoppingCart';
import { getMongoDB, mongoObjectId } from '#core/mongoDB';
import { getProductPrice } from './productItem';
import { toWeakETag } from '#core/eTag';
import { getShoppingCartsCollection } from './shoppingCartDetails/shoppingCartDetails';
import { ObjectId } from 'mongodb';
//import { getShoppingCartsCollection } from './shoppingCartDetails';

//////////////////////////////////////
/// Routes
//////////////////////////////////////

export const router = Router();

const handleCommand = CommandHandler<
  ShoppingCart,
  ShoppingCartCommand,
  ShoppingCartEvent
>(getEventStore, toShoppingCartStreamId, decider);

const on = HTTPHandler<ShoppingCartCommand>(handleCommand);

// Open Shopping cart
router.post(
  '/clients/:clientId/shopping-carts/',
  on((request, handle) => {
    const shoppingCartId = mongoObjectId();

    return handle(shoppingCartId, {
      type: 'OpenShoppingCart',
      data: {
        shoppingCartId,
        clientId: assertNotEmptyString(request.params.clientId),
        now: new Date(),
      },
    });
  }),
);

type AddProductItemToShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

// Add Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on(async (request: AddProductItemToShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    const productId = assertNotEmptyString(request.body.productId);
    const quantity = assertPositiveNumber(request.body.quantity);

    const price = await getProductPrice(productId);

    return handle(shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: {
        shoppingCartId,
        productItem: {
          productId,
          quantity,
          price,
        },
      },
    });
  }),
);

export type RemoveProductItemFromShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  unknown,
  Partial<{ productId: number; quantity: number; price: number }>
>;

// Remove Product Item
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on((request: RemoveProductItemFromShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'RemoveProductItemFromShoppingCart',
      data: {
        shoppingCartId,
        productItem: {
          productId: assertNotEmptyString(request.query.productId),
          quantity: assertPositiveNumber(request.query.quantity),
          price: assertPositiveNumber(request.query.price),
        },
      },
    });
  }),
);

type ConfirmShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Confirm Shopping Cart
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/confirm',
  on((request: ConfirmShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'ConfirmShoppingCart',
      data: {
        shoppingCartId,
        now: new Date(),
      },
    });
  }),
);

type CancelShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Cancel Shopping Cart
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  on((request: CancelShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'CancelShoppingCart',
      data: {
        shoppingCartId,
        now: new Date(),
      },
    });
  }),
);

router.get(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const collection = getShoppingCartsCollection(await getMongoDB());

      const result = await collection.findOne({
        _id: new ObjectId(assertNotEmptyString(request.params.shoppingCartId)),
      });

      if (result === null) {
        response.sendStatus(404);
        return;
      }

      response.set('ETag', toWeakETag(result.revision));
      response.send(result);
    } catch (error) {
      next(error);
    }
  },
);
