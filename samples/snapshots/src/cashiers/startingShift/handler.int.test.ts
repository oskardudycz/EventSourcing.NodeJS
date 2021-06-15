import { EventStoreDBClient } from '@eventstore/db-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import {
  handlePlaceAtWorkStation,
  PlaceAtWorkStation,
} from '../placeAtWorkStation/handler';
import { v4 as uuid } from 'uuid';
import { addCashRegister, updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import { expectStreamToHaveNumberOfEvents } from '../../testing/assertions/streams';
import { handleStartShift, StartShift } from '../startingShift';
import {
  handleRegisterTransaction,
  RegisterTransaction,
} from '../registeringTransaction';
import { EndShift, handleEndShift } from '../endingShift';

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
        handlePlaceAtWorkStation
      )
    ).toBeTruthy();

    const startShift: StartShift = {
      type: 'start-shift',
      data: {
        cashRegisterId,
        cashierId: uuid(),
      },
    };

    expect(
      await updateCashRegister(streamName, startShift, handleStartShift)
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
        handleRegisterTransaction
      )
    ).toBeTruthy();

    const command: EndShift = {
      type: 'end-shift',
      data: {
        cashRegisterId: uuid(),
      },
    };

    expect(
      await updateCashRegister(streamName, command, handleEndShift)
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
        cashierId: uuid(),
      },
    };

    const result = await updateCashRegister(
      streamName,
      command,
      handleStartShift
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
