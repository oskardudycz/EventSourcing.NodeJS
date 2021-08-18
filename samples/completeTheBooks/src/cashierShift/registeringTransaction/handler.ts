import { v4 as uuid } from 'uuid';
import { Command } from '#core/commands';
import { Event, StreamEvent } from '#core/events';
import { Result, success, getCurrentTime, failure } from '#core/primitives';
import {
  CashierShiftEvent,
  CashierShiftStatus,
  getCashierShiftFrom,
  isCashierShift,
  SHIFT_NOT_OPENED,
} from '../cashierShift';

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
    shiftNumber: number;
    amount: number;
    registeredAt: Date;
  }
>;

export function handleRegisterTransaction(
  events: StreamEvent<CashierShiftEvent>[],
  command: RegisterTransaction
): Result<TransactionRegistered, SHIFT_NOT_OPENED> {
  const cashierShift = getCashierShiftFrom(events);

  if (
    !isCashierShift(cashierShift) ||
    cashierShift.status !== CashierShiftStatus.Opened
  ) {
    return failure('SHIFT_NOT_OPENED');
  }

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
