import { v4 as uuid } from 'uuid';
import { Command } from '#core/commands';
import { Event } from '#core/events';
import { aggregateStream } from '#core/streams';
import { Result, success, getCurrentTime, failure } from '#core/primitives';
import {
  CashierShift,
  CashierShiftEvent,
  CashierShiftStatus,
  isCashierShift,
  when,
} from '../cashierShift';

export type SHIFT_NOT_STARTED = 'SHIFT_NOT_STARTED';

export type RegisterTransaction = Command<
  'register-transaction',
  {
    cashierShiftId: string;
    cashRegisterId: string;
    amount: number;
  }
>;

export type TransactionRegistered = Event<
  'transaction-registered',
  {
    transactionId: string;
    cashierShiftId: string;
    amount: number;
    registeredAt: Date;
  }
>;

export function handleRegisterTransaction(
  events: CashierShiftEvent[],
  command: RegisterTransaction
): Result<TransactionRegistered, SHIFT_NOT_STARTED> {
  const cashRegister = aggregateStream<CashierShift, CashierShiftEvent>(
    events,
    when,
    isCashierShift
  );

  if (cashRegister.status !== CashierShiftStatus.Started)
    return failure('SHIFT_NOT_STARTED');

  return success({
    type: 'transaction-registered',
    data: {
      cashierShiftId: cashRegister.id,
      transactionId: uuid(),
      amount: command.data.amount,
      registeredAt: getCurrentTime(),
    },
  });
}
