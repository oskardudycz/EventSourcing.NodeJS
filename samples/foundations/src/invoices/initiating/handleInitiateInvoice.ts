import { InitiateInvoice } from './initiateInvoice';
import { InvoiceInitiated } from './invoiceInitiated';

export function handleInitiateInvoice(
  command: InitiateInvoice,
  generateIvoiceNumber: () => string
): InvoiceInitiated {
  return {
    type: 'invoice-initiated',
    data: {
      amount: command.data.amount,
      issuedTo: command.data.issuedTo,
      number: generateIvoiceNumber(),
      initiatedAt: new Date(),
    },
  };
}
