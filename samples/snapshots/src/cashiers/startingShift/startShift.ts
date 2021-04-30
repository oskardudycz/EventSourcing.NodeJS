import { Command } from '../../core/commands/command';

export type StartShift = Command<
  'start-shift',
  {
    cashRegisterId: string;
    cashierId: string;
  }
>;
