import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { getCurrentTime } from '#core/primitives';
import { getArchivisationScheduleStreamName } from '../../archivisation';
import {
  handleStreamArchivisationScheduled,
  StreamArchivisationScheduled,
} from './eventHandler';
import { getCurrentCashierShiftStreamName } from '../../cashierShift/cashierShift';

describe('ShiftOpened event', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashRegisterId = uuid();

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should trigger closed shift archivisation', async () => {
    const event: StreamArchivisationScheduled = {
      type: 'stream-archivisation-scheduled',
      data: {
        streamName: getCurrentCashierShiftStreamName(cashRegisterId),
        archiveBeforeRevision: 4n.toString(),
        scheduledAt: getCurrentTime(),
      },
    };

    const result = await handleStreamArchivisationScheduled({
      event,
      streamRevision: 2n,
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
      1
    );
  });
});
