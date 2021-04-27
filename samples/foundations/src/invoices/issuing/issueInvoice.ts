import { Command } from '../../core/commands/command';

export type IssueInvoice = Command<
  'issue-invoice',
  {
    readonly number: string;
    readonly issuedBy: string;
  }
>;
