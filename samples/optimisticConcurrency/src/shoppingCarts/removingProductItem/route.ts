import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { handleRemovingProductItemFromShoppingCart } from './handler';
import { getShoppingCartStreamName } from '../shoppingCart';
import {
  isNotEmptyString,
  isPositiveNumber,
  ValidationError,
} from '#core/validation';
import {
  getWeakETagValueFromIfMatch,
  toWeakETag,
  WRONG_ETAG,
} from '#core/http/requests';
import { RemoveProductItemFromShoppingCart } from '.';
import { getAndUpdate } from '#core/eventStore/appending';
import { assertUnreachable } from '#core/primitives';

export const route = (router: Router) =>
  router.delete(
    '/clients/:clientId/shopping-carts/:shoppingCartId/product-items',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          return next({ status: 400, message: command });
        }

        const streamName = getShoppingCartStreamName(
          command.data.shoppingCartId
        );

        const result = await getAndUpdate(
          handleRemovingProductItemFromShoppingCart,
          streamName,
          command
        );

        if (result.isError) {
          switch (result.error) {
            case 'SHOPPING_CARD_CLOSED':
            case 'NOT_ENOUGH_PRODUCT_IN_SHOPPING_CART':
              return next({ status: 409 });
            case 'FAILED_TO_APPEND_EVENT':
              return next({ status: 412 });
            case 'STREAM_NOT_FOUND':
              return next({ status: 404 });
            default:
              assertUnreachable(result.error);
          }
        }

        response.set('ETag', toWeakETag(result.value.nextExpectedRevision));
        response.sendStatus(200);
      } catch (error) {
        next(error);
      }
    }
  );

function mapRequestToCommand(
  request: Request
): RemoveProductItemFromShoppingCart | ValidationError | WRONG_ETAG {
  if (!isNotEmptyString(request.params.shoppingCartId)) {
    return 'MISSING_SHOPPING_CARD_ID';
  }

  if (!isNotEmptyString(request.body.productId)) {
    return 'MISSING_PRODUCT_ID';
  }

  if (!isPositiveNumber(request.body.quantity)) {
    return 'INVALID_PRODUCT_ITEM_QUANTITY';
  }

  const expectedRevision = getWeakETagValueFromIfMatch(request);

  if (expectedRevision.isError) {
    return expectedRevision.error;
  }

  return {
    type: 'remove-product-item-from-shopping-cart',
    data: {
      shoppingCartId: request.params.shoppingCartId,
      productItem: {
        productId: request.body.productId,
        quantity: request.body.quantity,
      },
    },
    metadata: {
      $expectedRevision: expectedRevision.value,
    },
  };
}
