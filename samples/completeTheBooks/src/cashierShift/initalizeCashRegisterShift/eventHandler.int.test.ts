import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { handleCashRegisterPlacedAtWorkStation } from './eventHandler';
import { getCurrentTime } from '#core/primitives';
import { PlacedAtWorkStation } from '../../cashRegisters/placeAtWorkStation';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { getCashRegisterStreamName } from '../../cashRegisters/cashRegister';

describe('PlacedAtWorkStation event', () => {
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

  it('should iniate current cashier shift stream', async () => {
    const event: PlacedAtWorkStation = {
      type: 'placed-at-workstation',
      data: {
        cashRegisterId,
        workstation: 'WS #01',
        placedAt: getCurrentTime(),
      },
    };

    const result = await handleCashRegisterPlacedAtWorkStation({
      event,
      streamRevision: 0n,
      streamName: getCashRegisterStreamName(cashRegisterId),
    });

    expect(result.isError).toBeFalsy();

    if (result.isError) {
      expect(true).toBeFalsy();
      return;
    }

    const currentCashierShiftStreamName =
      getCurrentCashierShiftStreamName(cashRegisterId);

    await expectStreamToHaveNumberOfEvents(
      eventStore,
      currentCashierShiftStreamName,
      1
    );
  });
});
