import { getEventStore } from '#core/eventStore';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { updateCashierShift } from '../processCashierShift';
import type { CashierShiftEvent } from '../cashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import type { OpenShift } from '.';
import { handleOpenShift } from '.';
import { appendToStream } from '#core/eventStore/appending';
import { getCurrentTime } from '#core/primitives';
import { beforeAll, describe, expect, inject, it } from 'vitest';

describe('OpenShift command', () => {
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();
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
      ],
    );
    expect(result.isError).toBeFalsy();
  });

  it('should open current shift for initiating, cash register with closed shift', async () => {
    const command: OpenShift = {
      type: 'open-shift',
      data: {
        cashRegisterId,
        cashierId: uuid(),
        declaredStartAmount: 100,
      },
    };

    const result = await updateCashierShift(
      streamName,
      command,
      handleOpenShift,
    );

    expect(result.isError).toBeFalsy();

    if (result.isError) {
      expect(true).toBeFalsy();
      return;
    }

    expect(result.value.nextExpectedRevision).toBe(1n);
    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 2);
  });
});
