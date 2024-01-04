import { AppendResult } from '#core/eventStore/appending';
import { EventStoreDBClient } from '@eventstore/db-client';
import { setupInitiatedCashierShift } from './setupInitiatedCashierShift';
import { openedCashierShift } from './openCashierShift';

export async function setupOpenedCashierShift(
  eventStore: EventStoreDBClient,
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
