import { Request, Router } from 'express';
import { v4 as uuid } from 'uuid';
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
    const shoppingCartId = uuid();

    return handle(shoppingCartId, {
      type: 'OpenShoppingCart',
      data: {
        shoppingCartId,
        clientId: assertNotEmptyString(request.params.clientId),
      },
    });
  })
);

type AddProductItemToShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

// Add Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on((request: AddProductItemToShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: {
        shoppingCartId,
        productItem: {
          productId: assertNotEmptyString(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        },
      },
    });
  })
);

export type RemoveProductItemFromShoppingCartRequest = Request<
  Partial<{ shoppingCartId: string }>,
  unknown,
  unknown,
  Partial<{ productId: number; quantity: number }>
>;

// Remove Product Item
router.post(
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
        },
      },
    });
  })
);

type ConfirmShoppingCartRequest = Request<Partial<{ shoppingCartId: string }>>;

// Confirm Shopping Cart
router.put(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  on((request: ConfirmShoppingCartRequest, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'ConfirmShoppingCart',
      data: {
        shoppingCartId,
      },
    });
  })
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
      },
    });
  })
);

// router.get(
//   '/clients/:clientId/shopping-carts/:shoppingCartId',
//   async (request: Request, response: Response, next: NextFunction) => {
//     try {
//       const collection = await getShoppingCartsCollection();

//       const result = await collection.findOne({
//         shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
//       });

//       if (result === null) {
//         response.sendStatus(404);
//         return;
//       }

//       response.set('ETag', toWeakETag(result.revision));
//       response.send(result);
//     } catch (error) {
//       next(error);
//     }
//   }
// );
