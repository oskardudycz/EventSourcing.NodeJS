import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { OpenShift, handleOpenShift } from './handler';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { isNotEmptyString, isPositiveNumber } from '#core/validation';
import {
  getWeakETagFromIfMatch,
  MISSING_IF_MATCH_HEADER,
  toWeakETag,
  WRONG_WEAK_ETAG_FORMAT,
} from '#core/http/requests';
import { updateCashierShift } from '../processCashierShift';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:cashRegisterId/shifts/current',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const streamName = getCurrentCashierShiftStreamName(
          command.data.cashRegisterId,
        );

        const result = await updateCashierShift(
          streamName,
          command,
          handleOpenShift,
        );

        if (result.isError) {
          switch (result.error) {
            case 'SHIFT_ALREADY_OPENED':
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
    },
  );

function mapRequestToCommand(
  request: Request,
):
  | OpenShift
  | 'MISSING_CASH_REGISTER_ID'
  | 'MISSING_CASHIER_ID'
  | 'MISSING_FLOAT'
  | WRONG_WEAK_ETAG_FORMAT
  | MISSING_IF_MATCH_HEADER {
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

  const expectedRevision = getWeakETagFromIfMatch(request);

  if (expectedRevision.isError) {
    return expectedRevision.error;
  }

  return {
    type: 'open-shift',
    data: {
      cashRegisterId: request.params.cashRegisterId,
      cashierId: request.body.cashierId,
      declaredStartAmount: request.body.float,
    },
    metadata: {
      $expectedRevision: expectedRevision.value,
    },
  };
}
