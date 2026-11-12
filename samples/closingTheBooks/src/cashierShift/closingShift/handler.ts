import type { Command } from '#core/commands';
import type { Event, StreamEvent } from '#core/events';
import type { Result } from '#core/primitives';
import { failure, success } from '#core/primitives';
import { getCurrentTime } from '#core/primitives';
import type {
  CashierShiftEvent,
  SHIFT_ALREADY_CLOSED,
  SHIFT_NOT_OPENED,
} from '../cashierShift';
import {
  CashierShiftStatus,
  getCashierShiftFrom,
  isCashierShift,
} from '../cashierShift';

export type CloseShift = Command<
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
    closedAt: Date;
  }
>;

export function handleCloseShift(
  events: StreamEvent<CashierShiftEvent>[],
  command: CloseShift,
): Result<ShiftClosed, SHIFT_ALREADY_CLOSED | SHIFT_NOT_OPENED> {
  const cashierShift = getCashierShiftFrom(events);

  if (!isCashierShift(cashierShift)) {
    return failure('SHIFT_NOT_OPENED');
  }

  if (cashierShift.status === CashierShiftStatus.Closed) {
    return failure('SHIFT_ALREADY_CLOSED');
  }

  const declaredTender = command.data.declaredTender;
  const overageAmount = declaredTender - cashierShift.float;
  const shortageAmount = -overageAmount;

  return success({
    type: 'shift-closed',
    data: {
      shiftNumber: cashierShift.number,
      cashRegisterId: cashierShift.cashRegisterId,
      closedAt: getCurrentTime(),
      declaredTender: command.data.declaredTender,
      float: cashierShift.float,
      overageAmount,
      shortageAmount,
    },
  });
}
