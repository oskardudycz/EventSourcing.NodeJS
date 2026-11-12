import type { Command } from '#core/commands';
import type { Event, StreamEvent } from '#core/events';
import type { Result } from '#core/primitives';
import { success, getCurrentTime, failure } from '#core/primitives';
import type { CashierShiftEvent, SHIFT_ALREADY_OPENED } from '../cashierShift';
import {
  CashierShiftStatus,
  getCashierShiftFrom,
  isCashierShift,
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

export function isShiftOpened(event: Event): event is ShiftOpened {
  return event.type === 'shift-opened';
}

export function handleOpenShift(
  events: StreamEvent<CashierShiftEvent>[],
  command: OpenShift,
): Result<ShiftOpened, SHIFT_ALREADY_OPENED> {
  const cashierShift = getCashierShiftFrom(events);

  if (
    isCashierShift(cashierShift) &&
    cashierShift.status === CashierShiftStatus.Opened
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
