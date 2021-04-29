import { Event } from '../../core/events';
import { InvoiceSendMethod } from '../valueObjects';

export type InvoiceSent = Event<
  'invoice-sent',
  {
    number: string;
    sentVia: InvoiceSendMethod;
    sentAt: Date;
  }
>;
