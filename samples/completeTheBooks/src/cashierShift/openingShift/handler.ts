import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime, failure } from '#core/primitives';
import {
  CashierShiftEvent,
  CashierShiftStatus,
  getCashierShiftFrom,
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

  if (cashierShift.status === CashierShiftStatus.Opened) {
    return failure('SHIFT_ALREADY_OPENED');
  }

  return success({
    type: 'shift-opened',
    data: {
      shiftNumber: cashierShift.number,
      cashRegisterId: command.data.cashRegisterId,
      cashierId: command.data.cashierId,
      declaredStartAmount: command.data.declaredStartAmount,
      startedAt: getCurrentTime(),
    },
  });
}
