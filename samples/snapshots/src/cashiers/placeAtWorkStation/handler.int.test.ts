import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { handlePlaceAtWorkStation, PlaceAtWorkStation } from './handler';
import { v4 as uuid } from 'uuid';
import { addCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import { EventStoreDBClient } from '@eventstore/db-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import {
  expectStreamToHaveNumberOfEvents,
  expectStreamToNotExist,
} from '../../testing/assertions/streams';

describe('PlaceAtWorkStation command', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();

    eventStore = esdbContainer.getClient();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should place cash register at work station', async () => {
    const command: PlaceAtWorkStation = {
      type: 'place-at-workstation',
      data: {
        cashRegisterId: uuid(),
        workstation: 'WS#1',
      },
    };

    const streamName = getCashRegisterStreamName(command.data.cashRegisterId);

    const result = await addCashRegister(
      streamName,
      command,
      handlePlaceAtWorkStation
    );

    expect(result).toBeTruthy();

    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 1);

    await expectStreamToNotExist(eventStore, addSnapshotPrefix(streamName));
  });
});
