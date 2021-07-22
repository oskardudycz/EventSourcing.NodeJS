import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { handleRegisterTransaction, RegisterTransaction } from './handler';
import { updateCashierShift } from '../processCashierShift';
import { getCashierShiftStreamName } from '../cashierShift';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:id/transactions',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getCashierShiftStreamName(
          command.data.cashierShiftId
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
              break;
            case 'SHIFT_NOT_STARTED':
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
): RegisterTransaction | 'MISSING_CASH_REGISTER_ID' | 'MISSING_AMOUNT' {
  if (typeof request.params.id !== 'string') {
    return 'MISSING_CASH_REGISTER_ID';
  }

  if (typeof request.body.amount !== 'number') {
    return 'MISSING_AMOUNT';
  }

  return {
    type: 'register-transaction',
    data: {
      cashierShiftId: request.params.id,
      amount: request.body.amount,
    },
  };
}
