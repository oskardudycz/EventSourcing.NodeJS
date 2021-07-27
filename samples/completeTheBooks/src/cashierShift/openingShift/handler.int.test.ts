import { EventStoreDBClient } from '@eventstore/db-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '#config';
import { v4 as uuid } from 'uuid';
import { updateCashierShift } from '../processCashierShift';
import { getCashierShiftStreamName } from '../cashierShift';
import { expectStreamToHaveNumberOfEvents } from '../../testing/assertions/streams';
import { handleOpenShift, OpenShift } from '.';
import {
  handleRegisterTransaction,
  RegisterTransaction,
} from '../registeringTransaction';
import { ClosingShift, handleEndShift } from '../closingShift';

describe('OpenShift command', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;
  const cashierShiftId = uuid();
  const cashRegisterId = uuid();
  const streamName = getCashierShiftStreamName(cashRegisterId, cashierShiftId);

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();

    const startShift: OpenShift = {
      type: 'open-shift',
      data: {
        cashRegisterId,
        cashierId: uuid(),
        declaredStartAmount: 100,
      },
    };

    expect(
      await updateCashierShift(streamName, startShift, handleOpenShift)
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

    const command: ClosingShift = {
      type: 'close-shift',
      data: {
        cashRegisterId,
        cashierShiftId: uuid(),
        declaredTender: 100,
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
      handleOpenShift
    );

    expect(result).toBeTruthy();

    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 5);
    await expectStreamToHaveNumberOfEvents(
      eventStore,
      addSnapshotPrefix(streamName),
      1
    );
  });
});
