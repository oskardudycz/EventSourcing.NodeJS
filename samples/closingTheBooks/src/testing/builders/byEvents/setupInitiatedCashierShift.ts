import type { AppendResult } from '#core/eventStore/appending';
import { appendToStream } from '#core/eventStore/appending';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { getCurrentTime } from '#core/primitives';
import type { CashierShiftEvent } from '../../../cashierShift/cashierShift';
import { getCurrentCashierShiftStreamName } from '../../../cashierShift/cashierShift';
import { expect } from 'vitest';

export async function setupInitiatedCashierShift(
  eventStore: KurrentDBClient,
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
    throw new Error('Whooops! This should not happen!');
  }

  return result.value;
}
