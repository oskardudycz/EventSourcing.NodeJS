import type { Result } from '#core/primitives';
import { success } from '#core/primitives';
import type { StreamEvent } from '#core/events';
import type { SHIFT_ALREADY_INITIALIZED } from '../cashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import type { InitializeCashRegisterShift } from './handler';
import { handleInitializeCashRegisterShift } from './handler';
import { isPlacedAtWorkStation } from '../../cashRegisters/placeAtWorkStation';
import { addCashierShift } from '../processCashierShift';
import type { FAILED_TO_APPEND_EVENT } from '#core/eventStore/appending';

export async function handleCashRegisterPlacedAtWorkStation(
  streamEvent: StreamEvent,
): Promise<
  Result<boolean, SHIFT_ALREADY_INITIALIZED | FAILED_TO_APPEND_EVENT>
> {
  const { event } = streamEvent;
  if (!isPlacedAtWorkStation(event)) {
    return success(false);
  }
  const cashRegisterId = event.data.cashRegisterId;

  const command: InitializeCashRegisterShift = {
    type: 'initialize-cash-register-shift',
    data: {
      cashRegisterId,
    },
  };

  const streamName = getCurrentCashierShiftStreamName(
    command.data.cashRegisterId,
  );

  const result = await addCashierShift(
    streamName,
    command,
    handleInitializeCashRegisterShift,
  );

  if (result.isError) {
    return result;
  }

  return success(true);
}
