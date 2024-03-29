import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { updateCashierShift } from '../processCashierShift';
import {
  CashierShiftEvent,
  getCurrentCashierShiftStreamName,
} from '../cashierShift';
import { handleOpenShift, OpenShift } from '.';
import { appendToStream } from '#core/eventStore/appending';
import { getCurrentTime } from '#core/primitives';

describe('OpenShift command', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashRegisterId = uuid();
  const streamName = getCurrentCashierShiftStreamName(cashRegisterId);

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().start();
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
      ],
    );
    expect(result.isError).toBeFalsy();
  });

  afterAll(async () => {
    await esdbContainer.stop();
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
