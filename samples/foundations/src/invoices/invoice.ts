import { InvoiceSendMethod, Person } from './valueObjects';
import { InvoiceStatus } from './valueObjects/invoiceStatus';

import { InvoiceInitiated } from './initiating/invoiceInitiated';
import { InvoiceIssued } from './issuing/invoiceIssued';
import { InvoiceSent } from './sending/invoiceSent';

export type Invoice = Readonly<{
  number: string;
  amount: number;
  status: InvoiceStatus;

  issuedTo: Person;
  initiatedAt: Date;

  issued?: Readonly<{
    by?: string;
    at?: Date;
  }>;

  sent?: Readonly<{
    via?: InvoiceSendMethod;
    at?: Date;
  }>;
}>;

export type InvoiceEvent = InvoiceInitiated | InvoiceIssued | InvoiceSent;

export function when(
  currentState: Partial<Invoice>,
  event: InvoiceEvent
): Partial<Invoice> {
  switch (event.type) {
    case 'invoice-initiated':
      return {
        number: event.data.number,
        amount: event.data.amount,
        status: InvoiceStatus.INITIATED,
        issuedTo: event.data.issuedTo,
        initiatedAt: event.data.initiatedAt,
      };
    case 'invoice-issued': {
      return {
        ...currentState,
        status: InvoiceStatus.ISSUED,
        issued: {
          by: event.data.issuedBy,
          at: event.data.issuedAt,
        },
      };
    }
    case 'invoice-sent': {
      return {
        ...currentState,
        status: InvoiceStatus.SENT,
        sent: {
          via: event.data.sentVia,
          at: event.data.sentAt,
        },
      };
    }
    default:
      throw 'Unexpected event type';
  }
}

export function isInvoice(invoice: Partial<Invoice>): invoice is Invoice {
  return (
    !!invoice.number &&
    !!invoice.amount &&
    !!invoice.status &&
    !!invoice.issuedTo &&
    !!invoice.initiatedAt &&
    (!invoice.issued || (!!invoice.issued.at && !!invoice.issued.by)) &&
    (!invoice.sent || (!!invoice.sent.via && !!invoice.sent.at))
  );
}
