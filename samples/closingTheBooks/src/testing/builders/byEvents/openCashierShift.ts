import type { AppendResult } from '#core/eventStore/appending';
import { appendToStream } from '#core/eventStore/appending';
import { v4 as uuid } from 'uuid';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { getCurrentTime } from '#core/primitives';
import type { CashierShiftEvent } from '../../../cashierShift/cashierShift';
import { getCurrentCashierShiftStreamName } from '../../../cashierShift/cashierShift';
import { expect } from 'vitest';

export async function openedCashierShift(
  eventStore: KurrentDBClient,
  cashRegisterId: string,
  options: {
    cashierId?: string;
    declaredStartAmount?: number;
    shiftNumber?: number;
  } = {},
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
    ],
  );
  expect(result.isError).toBeFalsy();

  if (result.isError) {
    throw new Error('Whooops! This should not happen!');
  }

  return result.value;
}
