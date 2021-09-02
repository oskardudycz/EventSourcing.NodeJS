import { appendToStream, AppendResult } from '#core/eventStore/appending';
import { v4 as uuid } from 'uuid';
import { EventStoreDBClient } from '@eventstore/db-client';
import { getCurrentTime } from '#core/primitives';
import {
  CashierShiftEvent,
  getCurrentCashierShiftStreamName,
} from '../../../cashierShift/cashierShift';

export async function openedCashierShift(
  eventStore: EventStoreDBClient,
  cashRegisterId: string,
  options: {
    cashierId?: string;
    declaredStartAmount?: number;
    shiftNumber?: number;
  } = {}
): Promise<AppendResult> {
  const { cashierId, declaredStartAmount, shiftNumber } = {
    shiftNumber: 1,
    cashierId: uuid(),
    declaredStartAmount: 0,
    ...options,
  };

  const result = await appendToStream<CashierShiftEvent>(
    eventStore,
    getCurrentCashierShiftStreamName(cashRegisterId),
    [
      {
        type: 'shift-opened',
        data: {
          shiftNumber,
          cashRegisterId,
          cashierId,
          declaredStartAmount,
          startedAt: getCurrentTime(),
        },
      },
    ]
  );
  expect(result.isError).toBeFalsy();

  if (result.isError) {
    throw 'Whooops! This should not happen!';
  }

  return result.value;
}
