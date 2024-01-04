import { appendToStream, AppendResult } from '#core/eventStore/appending';
import { EventStoreDBClient } from '@eventstore/db-client';
import { getCurrentTime } from '#core/primitives';
import {
  CashierShiftEvent,
  getCurrentCashierShiftStreamName,
} from '../../../cashierShift/cashierShift';

export async function setupInitiatedCashierShift(
  eventStore: EventStoreDBClient,
  cashRegisterId: string,
): Promise<AppendResult> {
  const result = await appendToStream<CashierShiftEvent>(
    eventStore,
    getCurrentCashierShiftStreamName(cashRegisterId),
    [
      {
        type: 'cash-register-shift-initialized',
        data: {
          cashRegisterId,
          initializedAt: getCurrentTime(),
        },
      },
    ],
  );
  expect(result.isError).toBeFalsy();

  if (result.isError) {
    throw 'Whooops! This should not happen!';
  }

  return result.value;
}
