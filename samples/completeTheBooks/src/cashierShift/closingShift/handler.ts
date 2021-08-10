import { Command } from '#core/commands';
import { Event } from '#core/events';
import { failure, Result, success } from '#core/primitives';
import { getCurrentTime } from '#core/primitives';
import {
  CashierShiftEvent,
  CashierShiftStatus,
  getCashierShiftFrom,
  isCashierShift,
  SHIFT_ALREADY_CLOSED,
  SHIFT_NOT_INITIALIZED,
} from '../cashierShift';

export type ClosingShift = Command<
  'close-shift',
  {
    cashRegisterId: string;
    cashierShiftId: string;
    declaredTender: number;
  }
>;

export type ShiftClosed = Event<
  'shift-closed',
  {
    shiftNumber: number;
    cashRegisterId: string;
    declaredTender: number;
    overageAmount: number;
    shortageAmount: number;
    float: number;
    finishedAt: Date;
  }
>;

export function handleEndShift(
  events: CashierShiftEvent[],
  command: ClosingShift
): Result<ShiftClosed, SHIFT_ALREADY_CLOSED | SHIFT_NOT_INITIALIZED> {
  const cashierShift = getCashierShiftFrom(events);

  if (!isCashierShift(cashierShift)) return failure('SHIFT_NOT_INITIALIZED');

  if (cashierShift.status === CashierShiftStatus.Closed)
    return failure('SHIFT_ALREADY_CLOSED');

  const declaredTender = command.data.declaredTender;
  const overageAmount = declaredTender - cashierShift.float;
  const shortageAmount = -overageAmount;

  return success({
    type: 'shift-closed',
    data: {
      shiftNumber: cashierShift.number,
      cashRegisterId: cashierShift.cashRegisterId,
      finishedAt: getCurrentTime(),
      declaredTender: command.data.declaredTender,
      float: cashierShift.float,
      overageAmount,
      shortageAmount,
    },
  });
}
