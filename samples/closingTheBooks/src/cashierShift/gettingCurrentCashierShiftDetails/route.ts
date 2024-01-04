import { NextFunction, Request, Response, Router } from 'express';
import { isQuery } from '#core/queries';
import { isNotEmptyString } from '#core/validation';
import {
  GetCurrentCashierShiftDetails,
  handleGetCashierShift,
} from './queryHandler';
import { toWeakETag } from '#core/http/requests';

export const route = (router: Router) =>
  router.get(
    '/cash-registers/:cashRegisterId/shifts/current',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const query = mapRequestToQuery(request);

        if (!isQuery(query)) {
          next({ status: 400, message: query });
          return;
        }

        const result = await handleGetCashierShift(query);

        if (result.isError) {
          switch (result.error) {
            case 'SHIFT_DOES_NOT_EXIST':
              next({ status: 404 });
            default:
              next({ status: 500 });
          }
          return;
        }

        response.set('ETag', toWeakETag(result.value.revision));
        response.send(result.value);
      } catch (error) {
        next(error);
      }
    },
  );

function mapRequestToQuery(
  request: Request,
): GetCurrentCashierShiftDetails | 'MISSING_CASH_REGISTER_ID' {
  if (!isNotEmptyString(request.params.cashRegisterId)) {
    return 'MISSING_CASH_REGISTER_ID';
  }

  return {
    type: 'get-cashier-shift-details',
    data: {
      cashRegisterId: request.params.cashRegisterId,
    },
  };
}
