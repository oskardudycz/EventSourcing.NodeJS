import { NextFunction, Request, Response, Router } from 'express';
import { handleEndShift, EndShift } from './handler';
import { updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import { isCommand } from '#core/commands';

export const route = (router: Router) =>
  router.delete(
    '/cash-registers/:id/shifts',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getCashRegisterStreamName(
          command.data.cashRegisterId
        );

        const result = await updateCashRegister(
          streamName,
          command,
          handleEndShift
        );

        if (result.isError) {
          switch (result.error) {
            case 'STREAM_NOT_FOUND':
              response.sendStatus(404);
              break;
            case 'SHIFT_NOT_STARTED':
            case 'FAILED_TO_APPEND_EVENT':
              response.sendStatus(409);
              break;
            default:
              break;
          }
        }
        response.sendStatus(200);
      } catch (error) {
        next(error);
      }
    }
  );

function mapRequestToCommand(
  request: Request
): EndShift | 'MISSING_CASH_REGISTER_ID' | 'MISSING_CASHIER_ID' {
  if (!request.params.id || !(typeof request.params.id === 'string')) {
    return 'MISSING_CASH_REGISTER_ID';
  }

  return {
    type: 'end-shift',
    data: {
      cashRegisterId: request.params.id,
    },
  };
}
