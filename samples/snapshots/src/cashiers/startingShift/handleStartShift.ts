import { StartShift, ShiftStarted } from '.';
import { aggregateStream } from '../../core/streams';
import { CashRegister, CashRegisterEvent, when } from '../cashRegister';

export type ShiftAlreadyStarted = 'SHIFT_ALREADY_STARTED';

export function handleStartShift(
  events: CashRegisterEvent[],
  command: StartShift
): ShiftStarted | ShiftAlreadyStarted {
  const cashRegister = aggregateStream<CashRegister, CashRegisterEvent>(
    events,
    when
  );

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
