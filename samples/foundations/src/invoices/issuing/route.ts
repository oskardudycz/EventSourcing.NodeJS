import { Request, Response } from 'express';
import { InMemoryEventStore } from '../../core/eventStore/inMemoryEventStore';
import { InvoiceEvent } from '../invoice';
import { handleIssueInvoice } from './handleIssueInvoice';
import { IssueInvoice } from './issueInvoice';

export function route(request: Request, response: Response) {
  const command = mapRequestToCommand(request);

  const eventStore = new InMemoryEventStore();
  const events = eventStore.readFromStream<InvoiceEvent>(command.data.number);

  const newEvent = handleIssueInvoice(events, command);

  eventStore.appendToStream(command.data.number, newEvent);

  response.status(200);
}

function mapRequestToCommand(request: Request): IssueInvoice {
  // here should be more sophisticated validation and mapping
  return request.body as IssueInvoice;
}
