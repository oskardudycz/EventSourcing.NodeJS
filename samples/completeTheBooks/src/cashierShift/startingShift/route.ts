import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { StartShift, handleStartShift } from './handler';
import { getActiveCashierShiftStreamName } from '../cashierShift';
import { v4 as uuid } from 'uuid';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';
import { updateCashierShift } from '../processCashierShift';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:cashRegisterId/shifts/active',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getActiveCashierShiftStreamName(
          command.data.cashierShiftId
        );

        const result = await updateCashierShift(
          streamName,
          command,
          handleStartShift
        );

        if (result.isError) {
          switch (result.error) {
            case 'SHIFT_ALREADY_STARTED':
            case 'FAILED_TO_APPEND_EVENT':
              response.sendStatus(409);
              return;
            case 'STREAM_NOT_FOUND':
              response.sendStatus(404);
              return;
            default:
              response.sendStatus(500);
              return;
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
):
  | StartShift
  | 'MISSING_CASH_REGISTER_ID'
  | 'MISSING_CASHIER_ID'
  | 'MISSING_FLOAT' {
  if (!isNotEmptyString(request.params.cashRegisterId)) {
    return 'MISSING_CASH_REGISTER_ID';
  }

  if (!isNotEmptyString(request.body.cashierId)) {
    return 'MISSING_CASHIER_ID';
  }

  if (!isNotEmptyString(request.body.cashierId)) {
    return 'MISSING_CASHIER_ID';
  }

  if (!isPositiveNumber(request.body.float)) {
    return 'MISSING_FLOAT';
  }

  return {
    type: 'start-shift',
    data: {
      cashierShiftId: uuid(),
      cashRegisterId: request.params.cashRegisterId,
      cashierId: request.body.cashierId,
      float: request.body.float,
    },
  };
}
