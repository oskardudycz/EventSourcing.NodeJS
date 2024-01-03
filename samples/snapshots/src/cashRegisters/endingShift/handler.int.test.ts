import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { EndShift, handleEndShift } from './handler';
import {
  handlePlaceAtWorkStation,
  PlaceAtWorkStation,
} from '../placeAtWorkStation/handler';
import { v4 as uuid } from 'uuid';
import { addCashRegister, updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
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
  const streamName = getCashRegisterStreamName(cashRegisterId);

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();

    const placeAtWorkStation: PlaceAtWorkStation = {
      type: 'place-at-workstation',
      data: {
        cashRegisterId,
        workstation: 'WS#1',
      },
    };

    expect(
      await addCashRegister(
        streamName,
        placeAtWorkStation,
        handlePlaceAtWorkStation,
      ),
    ).toBeTruthy();

    const startShift: StartShift = {
      type: 'start-shift',
      data: {
        cashRegisterId,
        cashierId: uuid(),
      },
    };

    expect(
      await updateCashRegister(streamName, startShift, handleStartShift),
    ).toBeTruthy();

    const registerTransaction: RegisterTransaction = {
      type: 'register-transaction',
      data: {
        cashRegisterId,
        amount: 123,
      },
    };

    expect(
      await updateCashRegister(
        streamName,
        registerTransaction,
        handleRegisterTransaction,
      ),
    ).toBeTruthy();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should end shift for existing, starting cash register shift', async () => {
    const command: EndShift = {
      type: 'end-shift',
      data: {
        cashRegisterId: uuid(),
      },
    };

    const result = await updateCashRegister(
      streamName,
      command,
      handleEndShift,
    );

    expect(result).toBeTruthy();

    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 4);
    await expectStreamToHaveNumberOfEvents(
      eventStore,
      addSnapshotPrefix(streamName),
      1,
    );
  });
});
