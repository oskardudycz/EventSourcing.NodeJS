import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { handleOpenShoppingCart, OpenShoppingCart } from './handler';
import { getShoppingCartStreamName } from '../shoppingCart';
import { isNotEmptyString, ValidationError } from '#core/validation';
import { toWeakETag } from '#core/http/requests';
import { add } from '#core/eventStore/appending';
import { getEventStore } from '#core/eventStore';
import { assertUnreachable } from '#core/primitives';
import { sendCreated } from '#core/http/responses';

export const route = (router: Router) =>
  router.post(
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

        const result = await add(
          handleOpenShoppingCart,
          getEventStore(),
          streamName,
          command
        );

        if (result.isError) {
          switch (result.error) {
            case 'FAILED_TO_APPEND_EVENT':
              return next({ status: 412 });
            default:
              assertUnreachable(result.error);
          }
        }

        response.set('ETag', toWeakETag(result.value.nextExpectedRevision));
        sendCreated(response, command.data.shoppingCartId);
      } catch (error) {
        next(error);
      }
    }
  );

function mapRequestToCommand(
  request: Request
): OpenShoppingCart | ValidationError {
  if (!isNotEmptyString(request.params.clientId)) {
    return 'MISSING_CLIENT_ID';
  }
  if (!isNotEmptyString(request.params.shoppingCartId)) {
    return 'MISSING_SHOPPING_CARD_ID';
  }

  return {
    type: 'open-shopping-cart',
    data: {
      clientId: request.body.clientId,
      shoppingCartId: request.body.shoppingCartId,
    },
  };
}
