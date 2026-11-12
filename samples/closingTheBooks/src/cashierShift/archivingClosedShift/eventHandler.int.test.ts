import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import type { ShiftOpened } from '../openingShift';
import { handleCashierShiftOpened } from './eventHandler';
import { getCurrentTime } from '#core/primitives';
import { getArchivisationScheduleStreamName } from '../../archivisation';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('ShiftOpened event', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();

    eventStore = kurrentDBContainer.getClient();
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
  });

  it('should trigger closed shift archivisation', async () => {
    const event: ShiftOpened = {
      type: 'shift-opened',
      data: {
        cashRegisterId,
        cashierId: uuid(),
        declaredStartAmount: 100,
        shiftNumber: 1,
        startedAt: getCurrentTime(),
      },
    };

    const result = await handleCashierShiftOpened({
      event,
      streamRevision: 2n,
      streamName: getCurrentCashierShiftStreamName(cashRegisterId),
    });

    expect(result.isError).toBeFalsy();

    if (result.isError) {
      expect(true).toBeFalsy();
      return;
    }

    const archivisationScheduleStreamName =
      getArchivisationScheduleStreamName();

    await expectStreamToHaveNumberOfEvents(
      eventStore,
      archivisationScheduleStreamName,
      1,
    );
  });
});
