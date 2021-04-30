import { StartShift, ShiftStarted } from '.';
import { aggregateStream } from '../../core/streams';
import { CashRegisterEvent, when } from '../cash-register';

export type ShiftAlreadyStarted = 'SHIFT_ALREADY_STARTED';

export function handleStartShift(
  events: CashRegisterEvent[],
  command: StartShift
): ShiftStarted | ShiftAlreadyStarted {
  const cashRegister = aggregateStream(events, when);

  if (cashRegister.currentCashierId !== undefined) {
    return 'SHIFT_ALREADY_STARTED';
  }

  return {
    type: 'shift-started',
    data: {
      cashRegisterId: cashRegister.id,
      cashierId: command.data.cashierId,
      startedAt: new Date(),
    },
  };
}
