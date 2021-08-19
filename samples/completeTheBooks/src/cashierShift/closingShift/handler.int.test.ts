import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { config } from '#config';
import { CloseShift, handleCloseShift } from './handler';
import { v4 as uuid } from 'uuid';
import { updateCashierShift } from '../processCashierShift';
import {
  CashierShiftEvent,
  getCurrentCashierShiftStreamName,
} from '../cashierShift';
import { EventStoreDBClient } from '@eventstore/db-client';
import { appendToStream } from '#core/eventStore/appending';
import { getCurrentTime } from '#core/primitives';

describe('ClosingShift command', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashRegisterId = uuid();
  const cashierId = uuid();
  const streamName = getCurrentCashierShiftStreamName(cashRegisterId);

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();

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
      ]
    );
    expect(result.isError).toBeFalsy();
  });

  afterAll(async () => {
    await esdbContainer.stop();
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
      handleCloseShift
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
