import type { Event } from '../../core/events';
import type { Person } from '../valueObjects';

export type InvoiceInitiated = Event<
  'invoice-initiated',
  {
    number: string;
    amount: number;
    issuedTo: Person;
    initiatedAt: Date;
  }
>;
