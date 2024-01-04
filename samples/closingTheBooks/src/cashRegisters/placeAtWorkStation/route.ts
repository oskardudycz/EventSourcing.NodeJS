import { NextFunction, Request, Response, Router } from 'express';
import { addCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import { PlaceAtWorkStation } from '.';
import { handlePlaceAtWorkStation } from './handler';
import { v4 as uuid } from 'uuid';
import { isCommand } from '#core/commands';
import { sendCreated } from '#core/http/responses';
import { toWeakETag } from '#core/http/requests';
export const route = (router: Router) =>
  router.post(
    '/cash-registers/',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getCashRegisterStreamName(
          command.data.cashRegisterId,
        );

        const result = await addCashRegister(
          streamName,
          command,
          handlePlaceAtWorkStation,
        );

        if (result.isError) {
          switch (result.error) {
            case 'STREAM_NOT_FOUND':
              return next({ status: 404 });
            case 'FAILED_TO_APPEND_EVENT':
              return next({ status: 412 });
            default:
              return next({ status: 500 });
          }
        }

        response.set('ETag', toWeakETag(result.value.nextExpectedRevision));
        sendCreated(response, command.data.cashRegisterId);
      } catch (error) {
        next(error);
      }
    },
  );

function mapRequestToCommand(
  request: Request,
): PlaceAtWorkStation | 'MISSING_WORKSTATION' {
  if (typeof request.body.workstation !== 'string') {
    return 'MISSING_WORKSTATION';
  }

  return {
    type: 'place-at-workstation',
    data: {
      cashRegisterId: uuid(),
      workstation: request.body.workstation,
    },
    metadata: {
      $expectedRevision: undefined,
    },
  };
}
