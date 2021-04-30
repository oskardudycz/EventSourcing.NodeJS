import { Router, Request, Response } from 'express';
import { StartShift } from './startShift';
import { getEventStore } from '../../core/eventStore';
import { readFromStream } from '../../core/eventStore/reading/readFromStream';
import { CashRegisterEvent, getCashRegisterStreamName } from '../cash-register';
import { handleStartShift } from './handleStartShift';
import { appendToStream } from '../../core/eventStore/appending/appendToStream';

const router = Router();
router.post(
  '/cash-registers/:id/shift',
  async function (request: Request, response: Response) {
    const command = mapRequestToCommand(request);

    const eventStore = getEventStore();

    const events = await readFromStream<CashRegisterEvent>(
      eventStore,
      getCashRegisterStreamName(command.data.cashRegisterId)
    );

    if (events === 'STREAM_NOT_FOUND') {
      response.status(404);
      response.end();
      return;
    }

    const newEvent = handleStartShift(events, command);

    if (newEvent === 'SHIFT_ALREADY_STARTED') {
      response.status(409);
      response.end();
      return;
    }

    await appendToStream(eventStore, command.data.cashRegisterId, newEvent);

    response.status(200);
    response.end();
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
