import { Request, Response } from 'express';
import { InMemoryEventStore } from '../../core/eventStore/inMemoryEventStore';
import { generateIvoiceNumber } from '../invoiceNumberGenerator';
import { handleInitiateInvoice } from './handleInitiateInvoice';
import { InitiateInvoice } from './initiateInvoice';

export function route(request: Request, response: Response) {
  const command = mapRequestToCommand(request);

  const eventStore = new InMemoryEventStore();

  const newEvent = handleInitiateInvoice(command, generateIvoiceNumber);

  eventStore.appendToStream(command.data.number, newEvent);

  response.status(201);
  response.json({ number: newEvent.data.number });
}

function mapRequestToCommand(request: Request): InitiateInvoice {
  // here should be more sophisticated validation and mapping
  return request.body as InitiateInvoice;
}
