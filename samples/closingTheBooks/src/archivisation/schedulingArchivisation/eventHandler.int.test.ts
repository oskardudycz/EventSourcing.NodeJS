import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { getCurrentTime } from '#core/primitives';
import {
  getArchivisationForStreamName,
  getArchivisationScheduleStreamName,
} from '../../archivisation';
import type { StreamArchivisationScheduled } from './eventHandler';
import { handleStreamArchivisationScheduled } from './eventHandler';
import { getCurrentCashierShiftStreamName } from '../../cashierShift/cashierShift';
import { setupOpenedCashierShiftWithPreviousClosed } from '#testing/builders/byEvents';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('StreamArchivisationScheduled event', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();
  const currentCashierShiftStreamName =
    getCurrentCashierShiftStreamName(cashRegisterId);
  let archiveBeforeRevision: string;

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();

    eventStore = kurrentDBContainer.getClient();

    const result = await setupOpenedCashierShiftWithPreviousClosed(
      eventStore,
      cashRegisterId,
    );

    archiveBeforeRevision = result.nextExpectedRevision.toString();
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
  });

  it('should trigger schedule stream copying', async () => {
    const event: StreamArchivisationScheduled = {
      type: 'stream-archivisation-scheduled',
      data: {
        streamName: currentCashierShiftStreamName,
        archiveBeforeRevision,
        scheduledAt: getCurrentTime(),
      },
    };

    const result = await handleStreamArchivisationScheduled({
      event,
      streamRevision: 1n,
      streamName: getArchivisationScheduleStreamName(),
    });

    expect(result.isError).toBeFalsy();

    if (result.isError) {
      expect(true).toBeFalsy();
      return;
    }

    await expectStreamToHaveNumberOfEvents(
      eventStore,
      getArchivisationForStreamName(currentCashierShiftStreamName),
      1,
    );
  });
});
