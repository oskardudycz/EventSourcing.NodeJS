import { EventStoreDBClient } from '@eventstore/db-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { v4 as uuid } from 'uuid';
import { addCashierShift, updateCashierShift } from '../processCashierShift';
import { getCashierShiftStreamName } from '../cashierShift';
import { expectStreamToHaveNumberOfEvents } from '../../testing/assertions/streams';
import { handleStartShift, StartShift } from '.';
import {
  handleRegisterTransaction,
  RegisterTransaction,
} from '../registeringTransaction';
import { EndShift, handleEndShift } from '../endingShift';

describe('EndShift command', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashierShiftId = uuid();
  const cashRegisterId = uuid();
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

    const command: EndShift = {
      type: 'end-shift',
      data: {
        cashRegisterId,
        cashierShiftId: uuid(),
      },
    };

    expect(
      await updateCashierShift(streamName, command, handleEndShift)
    ).toBeTruthy();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should start shift for existing, cash register with ended shift', async () => {
    const command: StartShift = {
      type: 'start-shift',
      data: {
        cashRegisterId,
        cashierShiftId,
        cashierId: uuid(),
      },
    };

    const result = await addCashierShift(streamName, command, handleStartShift);

    expect(result).toBeTruthy();

    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 5);
    await expectStreamToHaveNumberOfEvents(
      eventStore,
      addSnapshotPrefix(streamName),
      1
    );
  });
});
