import { aggregateStream } from '../../core/streams';
import { Invoice, InvoiceEvent, isInvoice, when } from '../invoice';
import { InvoiceStatus } from '../valueObjects/invoiceStatus';
import { InvoiceSent } from './invoiceSent';
import { SendInvoice } from './sendInvoice';

export function handleSendInvoice(
  events: InvoiceEvent[],
  command: SendInvoice
): InvoiceSent {
  const invoice = aggregateStream<Invoice, InvoiceEvent>(
    events,
    when,
    isInvoice
  );

  if (invoice.status !== InvoiceStatus.ISSUED)
    throw 'Invoice can be only sent for the issued invoice';

  return {
    type: 'invoice-sent',
    data: {
      number: invoice.number,
      sentVia: command.data.sentVia,
      sentAt: new Date(),
    },
  };
}
