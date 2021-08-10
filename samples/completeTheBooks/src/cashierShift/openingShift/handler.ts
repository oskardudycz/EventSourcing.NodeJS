import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime, failure } from '#core/primitives';
import {
  CashierShiftEvent,
  CashierShiftStatus,
  getCashierShiftFrom,
  isCashierShift,
  SHIFT_ALREADY_OPENED,
} from '../cashierShift';

export type OpenShift = Command<
  'open-shift',
  {
    cashRegisterId: string;
    cashierId: string;
    declaredStartAmount: number;
  }
>;

export type ShiftOpened = Event<
  'shift-opened',
  {
    shiftNumber: number;
    cashRegisterId: string;
    cashierId: string;
    declaredStartAmount: number;
    startedAt: Date;
  }
>;

export function handleOpenShift(
  events: CashierShiftEvent[],
  command: OpenShift
): Result<ShiftOpened, SHIFT_ALREADY_OPENED> {
  const cashierShift = getCashierShiftFrom(events);

  if (
    isCashierShift(cashierShift) &&
    cashierShift.status !== CashierShiftStatus.Opened
  ) {
    return failure('SHIFT_ALREADY_OPENED');
  }

  const currentShiftNumber = isCashierShift(cashierShift)
    ? cashierShift.number
    : 0;

  return success({
    type: 'shift-opened',
    data: {
      shiftNumber: currentShiftNumber,
      cashRegisterId: cashierShift.cashRegisterId,
      cashierId: command.data.cashierId,
      declaredStartAmount: command.data.declaredStartAmount,
      startedAt: getCurrentTime(),
    },
  });
}
