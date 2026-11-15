import { getEventStore } from '#core/eventStore';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { StreamArchivisationScheduled } from '../../archivisation/schedulingArchivisation/eventHandler';
import type { ShiftOpened } from '../openingShift';
import { handleCashierShiftOpened } from './eventHandler';
import { getCurrentTime } from '#core/primitives';
import { getArchivisationScheduleStreamName } from '../../archivisation';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { beforeAll, describe, expect, inject, it } from 'vitest';

describe('ShiftOpened event', () => {
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();

  beforeAll(() => {
    config.kurrentDB.connectionString = inject('kurrentDBConnectionString');

    eventStore = getEventStore();
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

    const cashierShiftStreamName =
      getCurrentCashierShiftStreamName(cashRegisterId);
    const scheduledForThisShift: unknown[] = [];

    for await (const { event } of eventStore.readStream(
      getArchivisationScheduleStreamName(),
    )) {
      if (
        event?.type === 'stream-archivisation-scheduled' &&
        (event.data as StreamArchivisationScheduled['data']).streamName ===
          cashierShiftStreamName
      )
        scheduledForThisShift.push(event);
    }

    expect(scheduledForThisShift).toHaveLength(1);
  });
});
