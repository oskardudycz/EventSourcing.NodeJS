import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { updateCashierShift } from '../processCashierShift';
import type { CashierShiftEvent } from '../cashierShift';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import type { OpenShift } from '.';
import { handleOpenShift } from '.';
import { appendToStream } from '#core/eventStore/appending';
import { getCurrentTime } from '#core/primitives';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('OpenShift command', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();
  const streamName = getCurrentCashierShiftStreamName(cashRegisterId);

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();

    eventStore = kurrentDBContainer.getClient();

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

  afterAll(async () => {
    await kurrentDBContainer.stop();
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
