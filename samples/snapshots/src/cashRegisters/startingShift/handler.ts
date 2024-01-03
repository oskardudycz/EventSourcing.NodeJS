import { Command } from '#core/commands';
import { Event } from '#core/events';
import { failure, Result, success, getCurrentTime } from '#core/primitives';
import { aggregateStream } from '#core/streams';
import {
  CashRegister,
  CashRegisterEvent,
  isCashRegister,
  when,
} from '../cashRegister';

export type SHIFT_ALREADY_STARTED = 'SHIFT_ALREADY_STARTED';

export type StartShift = Command<
  'start-shift',
  {
    cashRegisterId: string;
    cashierId: string;
  }
>;

export type ShiftStarted = Event<
  'shift-started',
  {
    cashRegisterId: string;
    cashierId: string;
    startedAt: Date;
  }
>;

export function handleStartShift(
  events: CashRegisterEvent[],
  command: StartShift,
): Result<ShiftStarted, SHIFT_ALREADY_STARTED> {
  const cashRegister = aggregateStream<CashRegister, CashRegisterEvent>(
    events,
    when,
    isCashRegister,
  );

  if (cashRegister.currentCashierId !== undefined) {
    return failure('SHIFT_ALREADY_STARTED');
  }

  return success({
    type: 'shift-started',
    data: {
      cashRegisterId: cashRegister.id,
      cashierId: command.data.cashierId,
      startedAt: getCurrentTime(),
    },
  });
}
