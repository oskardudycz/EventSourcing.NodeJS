import { Command } from '#core/commands';
import { Event } from '#core/events';
import { failure, Result, success } from '#core/primitives';
import { getCurrentTime } from '#core/primitives';
import { aggregateStream } from '#core/streams';
import {
  CashierShift,
  CashierShiftEvent,
  CashierShiftStatus,
  isCashierShift,
  when,
} from '../cashierShift';

export type ShiftAlreadyEnded = 'SHIFT_ALREADY_ENDED';

export type EndShift = Command<
  'end-shift',
  {
    cashRegisterId: string;
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
): Result<ShiftEnded, ShiftAlreadyEnded> {
  const cashierShift = aggregateStream<CashierShift, CashierShiftEvent>(
    events,
    when,
    isCashierShift
  );

  if (cashierShift.status === CashierShiftStatus.Finished) {
    return failure('SHIFT_ALREADY_ENDED');
  }

  return success({
    type: 'shift-ended',
    data: {
      cashierShiftId: cashierShift.id,
      finishedAt: getCurrentTime(),
    },
  });
}
