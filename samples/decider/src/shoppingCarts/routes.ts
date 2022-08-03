import { Router } from 'express';
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

// Add Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on((request, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'AddProductItemToShoppingCart',
      data: {
        shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
        productItem: {
          productId: assertNotEmptyString(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        },
      },
    });
  })
);

// Remove Product Item
router.post(
  '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
  on((request, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'RemoveProductItemFromShoppingCart',
      data: {
        shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
        productItem: {
          productId: assertNotEmptyString(request.body.productId),
          quantity: assertPositiveNumber(request.body.quantity),
        },
      },
    });
  })
);

// Confirm Shopping Cart
router.put(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  on((request, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'ConfirmShoppingCart',
      data: {
        shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
      },
    });
  })
);

// Confirm Shopping Cart
router.delete(
  '/clients/:clientId/shopping-carts/:shoppingCartId',
  on((request, handle) => {
    const shoppingCartId = assertNotEmptyString(request.params.shoppingCartId);

    return handle(shoppingCartId, {
      type: 'CancelShoppingCart',
      data: {
        shoppingCartId: assertNotEmptyString(request.params.shoppingCartId),
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
