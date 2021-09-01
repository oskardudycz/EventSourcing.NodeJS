import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { getCurrentTime } from '#core/primitives';
import { getArchivisationForStreamName } from '../../archivisation';
import {
  handleStreamArchivisationScheduled,
  StreamArchivisationScheduled,
} from './eventHandler';
import { getCurrentCashierShiftStreamName } from '../../cashierShift/cashierShift';
import { setupOpenedCashierShiftWithPreviousClosed } from '#testing/builders/byEvents';

describe('StreamArchivisationScheduled event', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashRegisterId = uuid();
  const currentCashierShiftStreamName =
    getCurrentCashierShiftStreamName(cashRegisterId);
  let archiveBeforeRevision: string;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();

    const result = await setupOpenedCashierShiftWithPreviousClosed(
      eventStore,
      cashRegisterId
    );

    archiveBeforeRevision = result.nextExpectedRevision.toString();
  });

  afterAll(async () => {
    await esdbContainer.stop();
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
    });

    expect(result.isError).toBeFalsy();

    if (result.isError) {
      expect(true).toBeFalsy();
      return;
    }

    await expectStreamToHaveNumberOfEvents(
      eventStore,
      getArchivisationForStreamName(currentCashierShiftStreamName),
      1
    );
  });
});
