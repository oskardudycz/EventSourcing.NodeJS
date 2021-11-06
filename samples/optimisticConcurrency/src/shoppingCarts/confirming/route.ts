import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { confirmShoppingCart } from './handler';
import { getShoppingCartStreamName } from '../shoppingCart';
import { isNotEmptyString, ValidationError } from '#core/validation';
import {
  getWeakETagValueFromIfMatch,
  toWeakETag,
  WRONG_ETAG,
} from '#core/http/requests';
import { ConfirmShoppingCart } from '.';
import { getAndUpdate } from '#core/eventStore/appending';
import { assertUnreachable } from '#core/primitives';

export const route = (router: Router) =>
  router.put(
    '/clients/:clientId/shopping-carts/:shoppingCartId',
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
          confirmShoppingCart,
          streamName,
          command
        );

        if (result.isError) {
          switch (result.error) {
            case 'SHOPPING_CARD_CLOSED':
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
): ConfirmShoppingCart | ValidationError | WRONG_ETAG {
  if (!isNotEmptyString(request.params.shoppingCartId)) {
    return 'MISSING_SHOPPING_CARD_ID';
  }

  const expectedRevision = getWeakETagValueFromIfMatch(request);

  if (expectedRevision.isError) {
    return expectedRevision.error;
  }

  return {
    type: 'confirm-shopping-cart',
    data: {
      shoppingCartId: request.body.shoppingCartId,
    },
    metadata: {
      $expectedRevision: expectedRevision.value,
    },
  };
}
