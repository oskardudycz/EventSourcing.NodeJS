import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { EndShift, handleEndShift } from './handler';
import { v4 as uuid } from 'uuid';
import { addCashierShift, updateCashierShift } from '../processCashierShift';
import { getCashierShiftStreamName } from '../cashierShift';
import { EventStoreDBClient } from '@eventstore/db-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import { expectStreamToHaveNumberOfEvents } from '../../testing/assertions/streams';
import { handleStartShift, StartShift } from '../startingShift';
import {
  handleRegisterTransaction,
  RegisterTransaction,
} from '../registeringTransaction';

describe('EndShift command', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashRegisterId = uuid();
  const cashierShiftId = uuid();
  const streamName = getCashierShiftStreamName(cashRegisterId, cashierShiftId);

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();

    const startShift: StartShift = {
      type: 'start-shift',
      data: {
        cashRegisterId,
        cashierShiftId,
        cashierId: uuid(),
      },
    };

    expect(
      await addCashierShift(streamName, startShift, handleStartShift)
    ).toBeTruthy();

    const registerTransaction: RegisterTransaction = {
      type: 'register-transaction',
      data: {
        cashRegisterId,
        cashierShiftId,
        amount: 123,
      },
    };

    expect(
      await updateCashierShift(
        streamName,
        registerTransaction,
        handleRegisterTransaction
      )
    ).toBeTruthy();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should end shift for existing, starting cash register shift', async () => {
    const command: EndShift = {
      type: 'end-shift',
      data: {
        cashRegisterId,
        cashierShiftId: uuid(),
      },
    };

    const result = await updateCashierShift(
      streamName,
      command,
      handleEndShift
    );

    expect(result).toBeTruthy();

    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 4);
    await expectStreamToHaveNumberOfEvents(
      eventStore,
      addSnapshotPrefix(streamName),
      1
    );
  });
});
