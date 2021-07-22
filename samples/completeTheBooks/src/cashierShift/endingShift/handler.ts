import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success } from '#core/primitives';
import { getCurrentTime } from '#core/primitives';
import { aggregateStream } from '#core/streams';
import {
  CashierShift,
  CashierShiftEvent,
  isCashierShift,
  when,
} from '../cashierShift';

export type ShiftNotStarted = 'SHIFT_NOT_STARTED';

export type EndShift = Command<
  'end-shift',
  {
    cashierShiftId: string;
  }
>;

export type ShiftEnded = Event<
  'shift-ended',
  {
    cashierShiftId: string;
    finishedAt: Date;
  }
>;

export function handleEndShift(
  events: CashierShiftEvent[],
  _: EndShift
): Result<ShiftEnded, ShiftNotStarted> {
  const cashRegister = aggregateStream<CashierShift, CashierShiftEvent>(
    events,
    when,
    isCashierShift
  );

  return success({
    type: 'shift-ended',
    data: {
      cashierShiftId: cashRegister.id,
      finishedAt: getCurrentTime(),
    },
  });
}
