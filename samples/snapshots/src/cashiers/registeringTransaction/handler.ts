import { Command } from '../../core/commands';
import { Event } from '../../core/events';
import { aggregateStream } from '../../core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashRegister,
  when,
} from '../cashRegister';
import { v4 as uuid } from 'uuid';
import { failure, Result, success } from '../../core/primitives/result';
import { getCurrentTime } from '../../core/primitives/getCurrentTime';

export type SHIFT_NOT_STARTED = 'SHIFT_NOT_STARTED';

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
): Result<TransactionRegistered, SHIFT_NOT_STARTED> {
  const cashRegister = aggregateStream<CashRegister, CashRegisterEvent>(
    events,
    when,
    isCashRegister
  );

  if (cashRegister.currentCashierId === undefined) {
    return failure('SHIFT_NOT_STARTED');
  }

  return success({
    type: 'transaction-registered',
    data: {
      cashRegisterId: cashRegister.id,
      transactionId: uuid(),
      amount: command.data.amount,
      registeredAt: getCurrentTime(),
    },
  });
}
