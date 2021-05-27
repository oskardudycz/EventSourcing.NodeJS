import { Request, Response, Router } from 'express';
import { addCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import { PlaceAtWorkStation } from '.';
import { handlePlaceAtWorkStation } from './handler';
import { v4 as uuid } from 'uuid';

export const route = (router: Router) =>
  router.post(
    '/cash-registers/',
    async function (request: Request, response: Response) {
      const command = mapRequestToCommand(request);

      if (command == 'MISSING_WORKSTATION') {
        response.sendStatus(400);
        return;
      }

      const streamName = getCashRegisterStreamName(command.data.cashRegisterId);

      await addCashRegister(streamName, command, handlePlaceAtWorkStation);

      response.setHeader(
        'Location',
        `/cash-registers/${command.data.cashRegisterId}`
      );
      response.sendStatus(201);
    }
  );

function mapRequestToCommand(
  request: Request
): PlaceAtWorkStation | 'MISSING_WORKSTATION' {
  if (
    !request.body.workstation ||
    !(typeof request.body.workstation === 'string')
  ) {
    return 'MISSING_WORKSTATION';
  }

  return {
    type: 'place-at-workstation',
    data: {
      cashRegisterId: uuid(),
      workstation: request.body.workstation,
    },
  };
}
