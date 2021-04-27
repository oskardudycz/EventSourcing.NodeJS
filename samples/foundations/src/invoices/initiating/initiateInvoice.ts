import { Command } from '../../core/commands/command';
import { Person } from '../valueObjects';

export type InitiateInvoice = Command<
  'initiate-invoice',
  {
    readonly number: string;
    readonly amount: number;
    readonly issuedTo: Person;
  }
>;
