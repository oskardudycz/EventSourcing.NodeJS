import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { handleConfirmShoppingCart } from './handler';
import { getShoppingCartStreamName } from '../shoppingCart';
import { isNotEmptyString } from '#core/validation';
import {
  getWeakETagFromIfMatch,
  MISSING_IF_MATCH_HEADER,
  toWeakETag,
  WRONG_WEAK_ETAG_FORMAT,
} from '#core/http/requests';
import { ConfirmShoppingCart } from '.';
import { getAndUpdate } from '#core/eventStore/appending';
import { getEventStore } from '#core/eventStore';

export const route = (router: Router) =>
  router.post(
    '/clients/:clientId/shopping-carts/:shoppingCartId',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getShoppingCartStreamName(
          command.data.shoppingCartId
        );

        const result = await getAndUpdate(
          handleConfirmShoppingCart,
          getEventStore(),
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
              return next({ status: 500 });
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
):
  | ConfirmShoppingCart
  | 'MISSING_SHOPPING_CARD_ID'
  | WRONG_WEAK_ETAG_FORMAT
  | MISSING_IF_MATCH_HEADER {
  if (!isNotEmptyString(request.params.shoppingCartId)) {
    return 'MISSING_SHOPPING_CARD_ID';
  }

  const expectedRevision = getWeakETagFromIfMatch(request);

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
