import { Result, success } from '#core/primitives';
import { StreamEvent } from '#core/events';
import {
  getCurrentCashierShiftStreamName,
  SHIFT_ALREADY_INITIALIZED,
} from '../cashierShift';
import {
  handleInitializeCashRegisterShift,
  InitializeCashRegisterShift,
} from './handler';
import { isPlacedAtWorkStation } from '../../cashRegisters/placeAtWorkStation';
import { addCashierShift } from '../processCashierShift';
import { FAILED_TO_APPEND_EVENT } from '#core/eventStore/appending';

export async function handleCashRegisterPlacedAtWorkStation(
  streamEvent: StreamEvent
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
    command.data.cashRegisterId
  );

  const result = await addCashierShift(
    streamName,
    command,
    handleInitializeCashRegisterShift
  );

  if (result.isError) {
    return result;
  }

  return success(true);
}
