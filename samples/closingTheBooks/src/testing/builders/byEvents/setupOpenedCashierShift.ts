import type { AppendResult } from '#core/eventStore/appending';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { setupInitiatedCashierShift } from './setupInitiatedCashierShift';
import { openedCashierShift } from './openCashierShift';

export async function setupOpenedCashierShift(
  eventStore: KurrentDBClient,
  cashRegisterId: string,
  options: {
    cashierId?: string;
    declaredStartAmount?: number;
    shiftNumber?: number;
  } = {},
): Promise<AppendResult> {
  await setupInitiatedCashierShift(eventStore, cashRegisterId);

  return openedCashierShift(eventStore, cashRegisterId, options);
}
