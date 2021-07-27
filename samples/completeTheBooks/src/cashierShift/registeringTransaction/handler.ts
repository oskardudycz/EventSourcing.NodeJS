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
  SHIFT_NOT_OPENED,
  when,
} from '../cashierShift';

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
    cashRegisterId: string;
    shiftNumber: number;
    amount: number;
    registeredAt: Date;
  }
>;

export function handleRegisterTransaction(
  events: CashierShiftEvent[],
  command: RegisterTransaction
): Result<TransactionRegistered, SHIFT_NOT_OPENED> {
  const cashierShift = aggregateStream<CashierShift, CashierShiftEvent>(
    events,
    when,
    isCashierShift
  );

  if (cashierShift.status !== CashierShiftStatus.Opened)
    return failure('SHIFT_NOT_OPENED');

  return success({
    type: 'transaction-registered',
    data: {
      cashRegisterId: cashierShift.cashRegisterId,
      shiftNumber: cashierShift.number,
      transactionId: uuid(),
      amount: command.data.amount,
      registeredAt: getCurrentTime(),
    },
  });
}
