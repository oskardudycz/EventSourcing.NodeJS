import { Request, Response, Router } from 'express';
import { StartShift, handleStartShift } from './handler';
import { updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/:id/shift',
    async function (request: Request, response: Response) {
      const command = mapRequestToCommand(request);

      if (command == 'CASH_REGISTER_NOT_FOUND') {
        response.sendStatus(404);
        return;
      }

      if (command == 'MISSING_CASHIER_ID') {
        response.sendStatus(400);
        return;
      }

      const streamName = getCashRegisterStreamName(command.data.cashRegisterId);

      const result = await updateCashRegister(
        streamName,
        command,
        handleStartShift
      );

      if (result == 'STREAM_NOT_FOUND') response.sendStatus(404);

      if (result == 'SHIFT_ALREADY_STARTED') response.sendStatus(409);

      response.sendStatus(200);
    }
  );

function mapRequestToCommand(
  request: Request
): StartShift | 'CASH_REGISTER_NOT_FOUND' | 'MISSING_CASHIER_ID' {
  if (!request.query.id || !(typeof request.query.id === 'string')) {
    return 'CASH_REGISTER_NOT_FOUND';
  }

  if (
    !request.body.cashierId ||
    !(typeof request.body.cashierId === 'string')
  ) {
    return 'MISSING_CASHIER_ID';
  }

  return {
    type: 'start-shift',
    data: {
      cashRegisterId: request.query.id,
      cashierId: request.body.cashierId,
    },
  };
}
