import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime } from '#core/primitives';

export type StartShift = Command<
  'start-shift',
  {
    cashierShiftId: string;
    cashRegisterId: string;
    cashierId: string;
  }
>;

export type ShiftStarted = Event<
  'shift-started',
  {
    cashierShiftId: string;
    cashRegisterId: string;
    cashierId: string;
    startedAt: Date;
  }
>;

export function handleStartShift(command: StartShift): Result<ShiftStarted> {
  return success({
    type: 'shift-started',
    data: {
      cashierShiftId: command.data.cashierShiftId,
      cashRegisterId: command.data.cashRegisterId,
      cashierId: command.data.cashierId,
      startedAt: getCurrentTime(),
    },
  });
}
