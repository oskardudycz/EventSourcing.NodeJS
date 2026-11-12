import type { Event } from '../../core/events';
import type { InvoiceSendMethod } from '../valueObjects';

export type InvoiceSent = Event<
  'invoice-sent',
  {
    number: string;
    sentVia: InvoiceSendMethod;
    sentAt: Date;
  }
>;
