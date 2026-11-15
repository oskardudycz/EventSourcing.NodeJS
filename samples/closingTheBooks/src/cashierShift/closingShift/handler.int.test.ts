import { getEventStore } from '#core/eventStore';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { config } from '#config';
import type { CloseShift } from './handler';
import { handleCloseShift } from './handler';
import { v4 as uuid } from 'uuid';
import { updateCashierShift } from '../processCashierShift';
import type { CashierShiftEvent } from '../cashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { appendToStream } from '#core/eventStore/appending';
import { getCurrentTime } from '#core/primitives';
import { beforeAll, describe, expect, inject, it } from 'vitest';

describe('ClosingShift command', () => {
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();
  const cashierId = uuid();
  const streamName = getCurrentCashierShiftStreamName(cashRegisterId);

  beforeAll(async () => {
    config.kurrentDB.connectionString = inject('kurrentDBConnectionString');

    eventStore = getEventStore();

    const result = await appendToStream<CashierShiftEvent>(
      eventStore,
      streamName,
      [
        {
          type: 'cash-register-shift-initialized',
          data: {
            cashRegisterId,
            initializedAt: getCurrentTime(),
          },
        },
        {
          type: 'shift-opened',
          data: {
            cashRegisterId,
            cashierId,
            shiftNumber: 1,
            declaredStartAmount: 0,
            startedAt: getCurrentTime(),
          },
        },
      ],
    );
    expect(result.isError).toBeFalsy();
  });

  it('should close the shift for existing, opened cash register shift', async () => {
    const command: CloseShift = {
      type: 'close-shift',
      data: {
        cashRegisterId,
        cashierShiftId: uuid(),
        declaredTender: 100,
      },
    };

    const result = await updateCashierShift(
      streamName,
      command,
      handleCloseShift,
    );

    expect(result.isError).toBeFalsy();

    if (result.isError) {
      expect(true).toBeFalsy();
      return;
    }

    expect(result.value.nextExpectedRevision).toBe(2n);
    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 3);
  });
});
