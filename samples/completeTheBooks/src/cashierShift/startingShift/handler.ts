import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime, failure } from '#core/primitives';
import {
  CashierShiftEvent,
  CashierShiftStatus,
  getCashierShiftFrom,
  SHIFT_ALREADY_STARTED,
} from '../cashierShift';

export type StartShift = Command<
  'start-shift',
  {
    cashierShiftId: string;
    cashRegisterId: string;
    cashierId: string;
    float: number;
  }
>;

export type ShiftStarted = Event<
  'shift-started',
  {
    cashierShiftId: string;
    cashRegisterId: string;
    cashierId: string;
    float: number;
    startedAt: Date;
  }
>;

export function handleStartShift(
  events: CashierShiftEvent[],
  command: StartShift
): Result<ShiftStarted, SHIFT_ALREADY_STARTED> {
  const cashierShift = getCashierShiftFrom(events);

  if (cashierShift.status === CashierShiftStatus.Started) {
    return failure('SHIFT_ALREADY_STARTED');
  }

  return success({
    type: 'shift-started',
    data: {
      cashierShiftId: cashierShift.id,
      cashRegisterId: command.data.cashRegisterId,
      cashierId: command.data.cashierId,
      float: command.data.float,
      startedAt: getCurrentTime(),
    },
  });
}
