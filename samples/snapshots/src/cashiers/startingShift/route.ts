import { Request, Response } from 'express';
import { StartShift } from './startShift';
import { getEventStore } from '../../core/eventStore';
import { getCashRegisterStreamName } from '../cashRegister';
import { handleStartShift } from './handleStartShift';
import { getCashRegisterEvents } from '../getCashRegisterEvents/indext';
import { saveCashRegister } from '../saveCashRegister';
import { cashierRouter as router } from '..';

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

    const eventStore = getEventStore();

    const streamName = getCashRegisterStreamName(command.data.cashRegisterId);
    const stream = await getCashRegisterEvents(eventStore, streamName);

    if (stream === 'STREAM_NOT_FOUND') {
      response.sendStatus(404);
      return;
    }

    const { events, lastSnapshotVersion } = stream;

    const newEvent = handleStartShift(events, command);

    if (newEvent === 'SHIFT_ALREADY_STARTED') {
      response.sendStatus(409);
      return;
    }

    await saveCashRegister(
      eventStore,
      streamName,
      events,
      newEvent,
      lastSnapshotVersion
    );

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

export { router };
