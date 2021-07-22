import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime } from '#core/primitives';
import { aggregateStream } from '#core/streams';
import {
  CashierShift,
  CashierShiftEvent,
  isCashierShift,
  when,
} from '../cashierShift';

export type SHIFT_ALREADY_STARTED = 'SHIFT_ALREADY_STARTED';

export type StartShift = Command<
  'start-shift',
  {
    cashierShiftId: string;
    cashierId: string;
  }
>;

export type ShiftStarted = Event<
  'shift-started',
  {
    cashierShiftId: string;
    cashierId: string;
    startedAt: Date;
  }
>;

export function handleStartShift(
  events: CashierShiftEvent[],
  command: StartShift
): Result<ShiftStarted, SHIFT_ALREADY_STARTED> {
  const cashierShift = aggregateStream<CashierShift, CashierShiftEvent>(
    events,
    when,
    isCashierShift
  );

  return success({
    type: 'shift-started',
    data: {
      cashierShiftId: cashierShift.id,
      cashierId: command.data.cashierId,
      startedAt: getCurrentTime(),
    },
  });
}
