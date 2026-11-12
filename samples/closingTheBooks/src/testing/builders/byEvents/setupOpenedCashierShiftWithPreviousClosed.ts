import type { AppendResult } from '#core/eventStore/appending';
import { v4 as uuid } from 'uuid';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { openedCashierShift, setupClosedCashierShiftWithTransactions } from '.';

export async function setupOpenedCashierShiftWithPreviousClosed(
  eventStore: KurrentDBClient,
  cashRegisterId: string,
  options: {
    cashierId?: string;
    declaredStartAmount?: number;
    numberOfTransactionsInPreviousShift?: number;
  } = {},
): Promise<AppendResult> {
  const {
    cashierId,
    declaredStartAmount,
    numberOfTransactionsInPreviousShift,
  } = {
    cashierId: uuid(),
    declaredStartAmount: 0,
    numberOfTransactionsInPreviousShift: 3,
    ...options,
  };
  await setupClosedCashierShiftWithTransactions(eventStore, cashRegisterId, {
    cashierId,
    shiftNumber: 1,
    numberOfTransactions: numberOfTransactionsInPreviousShift,
  });

  return openedCashierShift(eventStore, cashRegisterId, {
    shiftNumber: 2,
    cashierId,
    declaredStartAmount,
  });
}
