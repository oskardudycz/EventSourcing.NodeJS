import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { ShiftOpened } from '../openingShift';
import { handleCashierShiftOpened } from './eventHandler';
import { getCurrentTime } from '#core/primitives';
import { getArchivisationScheduleStreamName } from '../../archivisation/schedulingArchivisation/handler';

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
