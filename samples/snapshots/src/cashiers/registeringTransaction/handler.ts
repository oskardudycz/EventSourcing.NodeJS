import { Command } from '../../core/commands';
import { Event } from '../../core/events';
import { aggregateStream } from '../../core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashier,
  when,
} from '../cashRegister';
import { v4 as uuid } from 'uuid';

export type ShiftNotStarted = 'SHIFT_NOT_STARTED';

export type RegisterTransaction = Command<
  'register-transaction',
  {
    cashRegisterId: string;
    amount: number;
  }
>;

export type TransactionRegistered = Event<
  'transaction-registered',
  {
    transactionId: string;
    cashRegisterId: string;
    amount: number;
    registeredAt: Date;
  }
>;

export function handleRegisterTransaction(
  events: CashRegisterEvent[],
  command: RegisterTransaction
): TransactionRegistered | ShiftNotStarted {
  const cashRegister = aggregateStream<CashRegister, CashRegisterEvent>(
    events,
    when,
    isCashier
  );

  if (cashRegister.currentCashierId === undefined) {
    return 'SHIFT_NOT_STARTED';
  }

  return {
    type: 'transaction-registered',
    data: {
      cashRegisterId: cashRegister.id,
      transactionId: uuid(),
      amount: command.data.amount,
      registeredAt: new Date(),
    },
  };
}
