import type { Event } from '../../core/events';

export type InvoiceIssued = Event<
  'invoice-issued',
  {
    number: string;
    issuedBy: string;
    issuedAt: Date;
  }
>;
