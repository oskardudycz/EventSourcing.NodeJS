import type { AppendResult } from '#core/eventStore/appending';
import { appendToStream } from '#core/eventStore/appending';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { getCurrentTime } from '#core/primitives';
import type { CashierShiftEvent } from '../../../cashierShift/cashierShift';
import { getCurrentCashierShiftStreamName } from '../../../cashierShift/cashierShift';
import { expect } from 'vitest';

export async function registerTransaction(
  eventStore: KurrentDBClient,
  cashRegisterId: string,
  shiftNumber: number,
  options: { amount?: number; transactionId?: string } = {},
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
    ],
  );
  expect(result.isError).toBeFalsy();

  if (result.isError) {
    throw new Error('Whooops! This should not happen!');
  }

  return result.value;
}
