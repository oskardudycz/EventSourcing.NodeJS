import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { handleRegisterTransaction, RegisterTransaction } from './handler';
import { updateCashierShift } from '../processCashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';
import {
  getWeakETagFromIfMatch,
  MISSING_IF_MATCH_HEADER,
  toWeakETag,
  WRONG_WEAK_ETAG_FORMAT,
} from '#core/http/requests';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:cashRegisterId/shifts/current/transactions',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          return next({ status: 400, message: command });
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
              return next({ status: 404 });
            case 'SHIFT_NOT_OPENED':
              return next({ status: 409 });
            case 'FAILED_TO_APPEND_EVENT':
              return next({ status: 412 });
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
  | RegisterTransaction
  | 'MISSING_CASH_REGISTER_ID'
  | 'MISSING_CASHIER_SHIFT_ID'
  | 'MISSING_AMOUNT'
  | WRONG_WEAK_ETAG_FORMAT
  | MISSING_IF_MATCH_HEADER {
  if (!isNotEmptyString(request.params.cashRegisterId)) {
    return 'MISSING_CASH_REGISTER_ID';
  }

  if (!isPositiveNumber(request.body.amount)) {
    return 'MISSING_AMOUNT';
  }

  const expectedRevision = getWeakETagFromIfMatch(request);

  if (expectedRevision.isError) {
    return expectedRevision.error;
  }

  return {
    type: 'register-transaction',
    data: {
      cashRegisterId: request.params.cashRegisterId,
      amount: request.body.amount,
    },
    metadata: {
      $expectedRevision: expectedRevision.value,
    },
  };
}
