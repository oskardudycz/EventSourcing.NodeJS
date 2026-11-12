import type { NextFunction, Request, Response, Router } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { isCommand } from '#core/commands';
import type { StartShift } from './handler';
import { handleStartShift } from './handler';
import { updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';

type StartShiftRequest = Request<
  ParamsDictionary,
  unknown,
  Partial<{ cashierId: unknown }>
>;

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:id/shifts',
    async function (
      request: StartShiftRequest,
      response: Response,
      next: NextFunction,
    ) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getCashRegisterStreamName(
          command.data.cashRegisterId,
        );

        const result = await updateCashRegister(
          streamName,
          command,
          handleStartShift,
        );

        if (result.isError) {
          switch (result.error) {
            case 'STREAM_NOT_FOUND':
              response.sendStatus(404);
              break;
            case 'SHIFT_ALREADY_STARTED':
              response.sendStatus(409);
              break;
          }
        }

        response.sendStatus(200);
      } catch (error) {
        next(error);
      }
    },
  );

function mapRequestToCommand(
  request: StartShiftRequest,
): StartShift | 'MISSING_CASH_REGISTER_ID' | 'MISSING_CASHIER_ID' {
  if (typeof request.params.id !== 'string') {
    return 'MISSING_CASH_REGISTER_ID';
  }

  if (typeof request.body.cashierId !== 'string') {
    return 'MISSING_CASHIER_ID';
  }

  return {
    type: 'start-shift',
    data: {
      cashRegisterId: request.params.id,
      cashierId: request.body.cashierId,
    },
  };
}
