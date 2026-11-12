import type { AppendResult } from '#core/eventStore/appending';
import { appendToStream } from '#core/eventStore/appending';
import { v4 as uuid } from 'uuid';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { getCurrentTime } from '#core/primitives';
import type { CashierShiftEvent } from '../../../cashierShift/cashierShift';
import { getCurrentCashierShiftStreamName } from '../../../cashierShift/cashierShift';
import { setupOpenedCashierShift } from '.';
import { registerTransaction } from './registerTransaction';
import { expect } from 'vitest';

export async function setupClosedCashierShiftWithTransactions(
  eventStore: KurrentDBClient,
  cashRegisterId: string,
  options: {
    cashierId?: string;
    declaredStartAmount?: number;
    shiftNumber?: number;
    numberOfTransactions?: number;
  } = {},
): Promise<AppendResult> {
  const { cashierId, declaredStartAmount, shiftNumber, numberOfTransactions } =
    {
      cashierId: uuid(),
      declaredStartAmount: 0,
      shiftNumber: 1,
      numberOfTransactions: 3,
      ...options,
    };
  const transactionAmount = 10;

  // setup open shift
  await setupOpenedCashierShift(eventStore, cashRegisterId, {
    declaredStartAmount,
    shiftNumber: 1,
    cashierId,
  });

  // register transactions
  for (let i = numberOfTransactions; i > 0; i--) {
    await registerTransaction(eventStore, cashRegisterId, shiftNumber, {
      amount: transactionAmount,
    });
  }

  // close shift
  const float = declaredStartAmount + transactionAmount * numberOfTransactions;

  const result = await appendToStream<CashierShiftEvent>(
    eventStore,
    getCurrentCashierShiftStreamName(cashRegisterId),
    [
      {
        type: 'shift-closed',
        data: {
          shiftNumber,
          cashRegisterId,
          declaredTender: float,
          float,
          shortageAmount: 0,
          overageAmount: 0,
          closedAt: getCurrentTime(),
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
