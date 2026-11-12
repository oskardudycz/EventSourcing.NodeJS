import type { NextFunction, Request, Response, Router } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { isCommand } from '#core/commands';
import type { RegisterTransaction } from './handler';
import { handleRegisterTransaction } from './handler';
import { updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';

type RegisterTransactionRequest = Request<
  ParamsDictionary,
  unknown,
  Partial<{ amount: unknown }>
>;

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:id/transactions',
    async function (
      request: RegisterTransactionRequest,
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
          handleRegisterTransaction,
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
    },
  );

function mapRequestToCommand(
  request: RegisterTransactionRequest,
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
      cashRegisterId: request.params.id,
      amount: request.body.amount,
    },
  };
}
