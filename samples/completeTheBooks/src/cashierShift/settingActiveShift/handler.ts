import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime } from '#core/primitives';

export type SHIFT_ALREADY_STARTED = 'SHIFT_ALREADY_STARTED';

export type SetActiveShift = Command<
  'set-active-shift',
  {
    cashierShiftId: string;
    cashRegisterId: string;
  }
>;

export type ActiveShiftSet = Event<
  'active-shift-set',
  {
    activeCashierShiftId: string;
    cashRegisterId: string;
    setActiveAt: Date;
  }
>;

export function handleSetActiveShift(
  command: SetActiveShift
): Result<ActiveShiftSet> {
  return success({
    type: 'active-shift-set',
    data: {
      activeCashierShiftId: command.data.cashierShiftId,
      cashRegisterId: command.data.cashRegisterId,
      setActiveAt: getCurrentTime(),
    },
  });
}
