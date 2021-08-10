import { Command } from '#core/commands';
import { Event } from '#core/events';
import { Result, success, getCurrentTime } from '#core/primitives';

export type InitializeCashRegisterShift = Command<
  'initialize-cash-register-shift',
  {
    cashRegisterId: string;
  }
>;

export type CashRegisterShiftInitialized = Event<
  'cash-register-shift-initialized',
  {
    cashRegisterId: string;
    initializedAt: Date;
  }
>;

export function handleInitializeCashRegisterShift(
  command: InitializeCashRegisterShift
): Result<CashRegisterShiftInitialized> {
  return success({
    type: 'cash-register-shift-initialized',
    data: {
      cashRegisterId: command.data.cashRegisterId,
      initializedAt: getCurrentTime(),
    },
  });
}
