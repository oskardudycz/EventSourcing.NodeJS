import { appendToStream, AppendResult } from '#core/eventStore/appending';
import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { getCurrentTime } from '#core/primitives';
import {
  CashierShiftEvent,
  getCurrentCashierShiftStreamName,
} from '../../../cashierShift/cashierShift';

export async function registerTransaction(
  eventStore: EventStoreDBClient,
  cashRegisterId: string,
  shiftNumber: number,
  options: { amount?: number; transactionId?: string } = {}
): Promise<AppendResult> {
  const { amount, transactionId } = options;

  const result = await appendToStream<CashierShiftEvent>(
    eventStore,
    getCurrentCashierShiftStreamName(cashRegisterId),
    [
      {
        type: 'transaction-registered',
        data: {
          cashRegisterId,
          amount: amount ?? 10,
          shiftNumber,
          transactionId: transactionId ?? uuid(),
          registeredAt: getCurrentTime(),
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
