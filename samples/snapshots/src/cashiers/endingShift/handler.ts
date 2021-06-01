import { Command } from '../../core/commands';
import { Event } from '../../core/events';
import { aggregateStream } from '../../core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashier,
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
  _: EndShift
): ShiftEnded | ShiftNotStarted {
  const cashRegister = aggregateStream<CashRegister, CashRegisterEvent>(
    events,
    when,
    isCashier
  );

  if (cashRegister.currentCashierId === undefined) {
    return 'SHIFT_NOT_STARTED';
  }

  return {
    type: 'shift-ended',
    data: {
      cashRegisterId: cashRegister.id,
      finishedAt: new Date(),
    },
  };
}
