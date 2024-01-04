import { NextFunction, Request, Response, Router } from 'express';
import { handleCloseShift, CloseShift } from './handler';
import { updateCashierShift } from '../processCashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { isCommand } from '#core/commands';
import { isNotEmptyString } from '#core/validation';
import {
  getWeakETagFromIfMatch,
  MISSING_IF_MATCH_HEADER,
  toWeakETag,
  WRONG_WEAK_ETAG_FORMAT,
} from '#core/http/requests';

export const route = (router: Router) =>
  router.delete(
    '/cash-registers/:cashRegisterId/shifts/current',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          return next({ status: 400, message: command });
        }

        const streamName = getCurrentCashierShiftStreamName(
          command.data.cashRegisterId,
        );

        const result = await updateCashierShift(
          streamName,
          command,
          handleCloseShift,
        );

        if (result.isError) {
          switch (result.error) {
            case 'STREAM_NOT_FOUND':
              return next({ status: 404 });
            case 'SHIFT_NOT_OPENED':
            case 'SHIFT_ALREADY_CLOSED':
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
    },
  );

function mapRequestToCommand(
  request: Request,
):
  | CloseShift
  | 'MISSING_CASH_REGISTER_ID'
  | WRONG_WEAK_ETAG_FORMAT
  | MISSING_IF_MATCH_HEADER {
  if (!isNotEmptyString(request.params.cashRegisterId)) {
    return 'MISSING_CASH_REGISTER_ID';
  }
  const expectedRevision = getWeakETagFromIfMatch(request);

  if (expectedRevision.isError) {
    return expectedRevision.error;
  }

  return {
    type: 'close-shift',
    data: {
      cashRegisterId: request.params.cashRegisterId,
      cashierShiftId: request.params.id,
      declaredTender: 100,
    },
    metadata: {
      $expectedRevision: expectedRevision.value,
    },
  };
}
