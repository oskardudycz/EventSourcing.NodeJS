import { Command } from '../../core/commands/command';
import { InvoiceSendMethod } from '../valueObjects';

export type SendInvoice = Command<
  'send-invoice',
  {
    readonly number: string;
    readonly sentVia: InvoiceSendMethod;
  }
>;
