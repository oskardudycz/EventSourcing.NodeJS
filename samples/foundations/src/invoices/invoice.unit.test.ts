import { aggregateStream } from '../core/streams';
import { InvoiceInitiated } from './initiating/invoiceInitiated';
import { Invoice, InvoiceEvent, isInvoice, when } from './invoice';
import { InvoiceIssued } from './issuing/invoiceIssued';
import { InvoiceSent } from './sending/invoiceSent';
import { InvoiceSendMethod } from './valueObjects';
import { InvoiceStatus } from './valueObjects/invoiceStatus';

describe('invoice', () => {
  it('should get proper state when all events are aggregated', () => {
    const invoiceNumber = 'INV/2021/11/01';
    const invoiceInitiated: InvoiceInitiated = {
      type: 'invoice-initiated',
      data: {
        number: invoiceNumber,
        amount: 34.12,
        issuedTo: {
          name: 'Oscar the Grouch',
          address: '123 Sesame Street',
        },
        initiatedAt: new Date(),
      },
    };
    const invoiceIssued: InvoiceIssued = {
      type: 'invoice-issued',
      data: {
        number: invoiceNumber,
        issuedBy: 'Cookie Monster',
        issuedAt: new Date(),
      },
    };
    const invoiceSent: InvoiceSent = {
      type: 'invoice-sent',
      data: {
        number: invoiceNumber,
        sentVia: InvoiceSendMethod.EMAIL,
        sentAt: new Date(),
      },
    };

    // 1. 2. Get all events and sort them in the order of appearance
    const events = [invoiceInitiated, invoiceIssued, invoiceSent];

    // 3. Apply each event on the entity.
    const invoice = aggregateStream<Invoice, InvoiceEvent>(
      events,
      when,
      isInvoice,
    );

    expect(invoice).toMatchObject({
      number: invoiceNumber,
      amount: invoiceInitiated.data.amount,
      status: InvoiceStatus.SENT,
      issuedTo: invoiceInitiated.data.issuedTo,
      initiatedAt: invoiceInitiated.data.initiatedAt,
      issued: {
        by: invoiceIssued.data.issuedBy,
        at: invoiceIssued.data.issuedAt,
      },
      sent: {
        via: invoiceSent.data.sentVia,
        at: invoiceSent.data.sentAt,
      },
    });
  });
});
