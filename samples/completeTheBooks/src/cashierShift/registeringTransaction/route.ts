import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { handleRegisterTransaction, RegisterTransaction } from './handler';
import { updateCashierShift } from '../processCashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:cashRegisterId/shifts/:cashierShiftId/transactions',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getCurrentCashierShiftStreamName(
          command.data.cashRegisterId
        );

        const result = await updateCashierShift(
          streamName,
          command,
          handleRegisterTransaction
        );

        if (result.isError) {
          switch (result.error) {
            case 'STREAM_NOT_FOUND':
              response.sendStatus(404);
              return;
            case 'SHIFT_NOT_OPENED':
              response.sendStatus(409);
              return;
            case 'FAILED_TO_APPEND_EVENT':
              response.sendStatus(409);
              return;
            default:
              response.sendStatus(500);
              return;
          }
        }

        response.set('ETag', `W/"${result.value.nextExpectedRevision}"`);
        response.sendStatus(200);
      } catch (error) {
        next(error);
      }
    }
  );

function mapRequestToCommand(
  request: Request
):
  | RegisterTransaction
  | 'MISSING_CASH_REGISTER_ID'
  | 'MISSING_CASHIER_SHIFT_ID'
  | 'MISSING_AMOUNT' {
  if (!isNotEmptyString(request.params.cashRegisterId)) {
    return 'MISSING_CASH_REGISTER_ID';
  }

  if (!isNotEmptyString(request.params.cashierShiftId)) {
    return 'MISSING_CASHIER_SHIFT_ID';
  }

  if (!isPositiveNumber(request.body.amount)) {
    return 'MISSING_AMOUNT';
  }

  return {
    type: 'register-transaction',
    data: {
      cashierShiftId: request.params.cashierShiftId,
      cashRegisterId: request.params.cashRegisterId,
      amount: request.body.amount,
    },
    metadata: {
      $expectedRevision: <string>request.headers['If-Match'],
    },
  };
}
