import { NextFunction, Request, Response, Router } from 'express';
import { isCommand } from '#core/commands';
import { StartShift, handleStartShift } from './handler';
import { getCashierShiftStreamName } from '../cashierShift';
import { v4 as uuid } from 'uuid';
import { isNotEmptyString } from '#core/validation';
import { setActiveShift } from '../settingActiveShift/setActiveShift';
import { appendToStream } from '#core/eventStore/appending';
import { getEventStore } from '#core/eventStore';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:cashRegisterId/shifts',
    async function (request: Request, response: Response, next: NextFunction) {
      try {
        const command = mapRequestToCommand(request);

        if (!isCommand(command)) {
          next({ status: 400, message: command });
          return;
        }

        const event = handleStartShift(command);

        if (event.isError) {
          response.sendStatus(500);
          return;
        }

        const settingActiveResult = await setActiveShift({
          type: 'set-active-shift',
          data: {
            cashRegisterId: command.data.cashRegisterId,
            cashierShiftId: command.data.cashierShiftId,
          },
        });

        if (settingActiveResult.isError) {
          switch (settingActiveResult.error) {
            case 'SHIFT_ALREADY_STARTED':
              response.sendStatus(409);
              return;
            default:
              response.sendStatus(500);
              return;
          }
        }

        const streamName = getCashierShiftStreamName(
          command.data.cashRegisterId,
          command.data.cashierShiftId
        );

        const result = await appendToStream(getEventStore(), streamName, [
          event.value,
        ]);

        if (result.isError) {
          switch (result.error) {
            case 'FAILED_TO_APPEND_EVENT':
              response.sendStatus(409);
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
): StartShift | 'MISSING_CASH_REGISTER_ID' | 'MISSING_CASHIER_ID' {
  if (!isNotEmptyString(request.params.cashRegisterId)) {
    return 'MISSING_CASH_REGISTER_ID';
  }

  if (!isNotEmptyString(request.body.cashierId)) {
    return 'MISSING_CASHIER_ID';
  }

  return {
    type: 'start-shift',
    data: {
      cashierShiftId: uuid(),
      cashRegisterId: request.params.cashRegisterId,
      cashierId: request.body.cashierId,
    },
  };
}
