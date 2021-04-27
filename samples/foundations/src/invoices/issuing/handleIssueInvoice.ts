import { aggregateStream } from '../../core/streams';
import { Invoice, InvoiceEvent, isInvoice, when } from '../invoice';
import { InvoiceStatus } from '../valueObjects/invoiceStatus';
import { InvoiceIssued } from './invoiceIssued';
import { IssueInvoice } from './issueInvoice';

export function handleIssueInvoice(
  events: InvoiceEvent[],
  command: IssueInvoice
): InvoiceIssued {
  const invoice = aggregateStream<Invoice, InvoiceEvent>(
    events,
    when,
    isInvoice
  );

  if (invoice.status !== InvoiceStatus.INITIATED)
    throw 'Invoice can be only issued based on the invoice draft';

  return {
    type: 'invoice-issued',
    data: {
      number: invoice.number,
      issuedBy: command.data.issuedBy,
      issuedAt: new Date(),
    },
  };
}
