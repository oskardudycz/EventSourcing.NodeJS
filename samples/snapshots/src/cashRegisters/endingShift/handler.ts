import { Command } from '#core/commands';
import { Event } from '#core/events';
import { failure, Result, success } from '#core/primitives';
import { getCurrentTime } from '#core/primitives';
import { aggregateStream } from '#core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashRegister,
  when,
} from '../cashRegister';

export type ShiftNotStarted = 'SHIFT_NOT_STARTED';

export type EndShift = Command<
  'end-shift',
  {
    cashRegisterId: string;
  }
>;

export type ShiftEnded = Event<
  'shift-ended',
  {
    cashRegisterId: string;
    finishedAt: Date;
  }
>;

export function handleEndShift(
  events: CashRegisterEvent[],
  _: EndShift,
): Result<ShiftEnded, ShiftNotStarted> {
  const cashRegister = aggregateStream<CashRegister, CashRegisterEvent>(
    events,
    when,
    isCashRegister,
  );

  if (cashRegister.currentCashierId === undefined) {
    return failure('SHIFT_NOT_STARTED');
  }

  return success({
    type: 'shift-ended',
    data: {
      cashRegisterId: cashRegister.id,
      finishedAt: getCurrentTime(),
    },
  });
}
