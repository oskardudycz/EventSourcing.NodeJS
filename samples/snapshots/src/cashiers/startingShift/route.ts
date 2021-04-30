import { Router, Request, Response } from 'express';
import { StartShift } from './startShift';
import { getEventStore } from '../../core/eventStore';
import { getCashRegisterStreamName } from '../cashRegister';
import { handleStartShift } from './handleStartShift';
import { getCashRegisterEvents } from '../getCashRegisterEvents';
import { saveCashRegister } from '../saveCashRegister';

const router = Router();
router.post(
  '/cash-registers/:id/shift',
  async function (request: Request, response: Response) {
    const command = mapRequestToCommand(request);

    const eventStore = getEventStore();

    const streamName = getCashRegisterStreamName(command.data.cashRegisterId);

    const currentEvents = await getCashRegisterEvents(eventStore, streamName);

    if (currentEvents === 'STREAM_NOT_FOUND') {
      response.sendStatus(404);
      return;
    }

    const { events, lastSnapshotVersion } = currentEvents;

    const newEvent = handleStartShift(events, command);

    if (newEvent === 'SHIFT_ALREADY_STARTED') {
      response.sendStatus(409);
      return;
    }

    await saveCashRegister(
      eventStore,
      streamName,
      events,
      lastSnapshotVersion,
      newEvent
    );

    response.sendStatus(200);
  }
);

function mapRequestToCommand(request: Request): StartShift {
  if (!request.query.id || !(typeof request.query.id === 'string')) {
    throw 'Missing cash register id';
  }

  if (
    !request.body.cashierId ||
    !(typeof request.body.cashierId === 'string')
  ) {
    throw 'Missing cashier id';
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
