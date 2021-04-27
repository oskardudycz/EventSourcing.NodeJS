import { Request, Response } from 'express';
import { InMemoryEventStore } from '../../core/eventStore/inMemoryEventStore';
import { InvoiceEvent } from '../invoice';
import { handleSendInvoice } from './handleSendInvoice';
import { SendInvoice } from './sendInvoice';

export function route(request: Request, response: Response) {
  const command = mapRequestToCommand(request);

  const eventStore = new InMemoryEventStore();
  const events = eventStore.readFromStream<InvoiceEvent>(command.data.number);

  const newEvent = handleSendInvoice(events, command);

  eventStore.appendToStream(command.data.number, newEvent);

  response.status(200);
}

function mapRequestToCommand(request: Request): SendInvoice {
  // here should be more sophisticated validation and mapping
  return request.body as SendInvoice;
}
