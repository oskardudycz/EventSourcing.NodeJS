import type { StartedKurrentDBContainer } from '../../testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '../../testing/kurrentDB/kurrentDBContainer';
import { config } from '../../../config';
import type { PlaceAtWorkStation } from './handler';
import { handlePlaceAtWorkStation } from './handler';
import { v4 as uuid } from 'uuid';
import { addCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import {
  expectStreamToHaveNumberOfEvents,
  expectStreamToNotExist,
} from '../../testing/assertions/streams';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('PlaceAtWorkStation command', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let eventStore: KurrentDBClient;

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();

    eventStore = kurrentDBContainer.getClient();
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
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
      handlePlaceAtWorkStation,
    );

    expect(result).toBeTruthy();

    await expectStreamToHaveNumberOfEvents(eventStore, streamName, 1);

    await expectStreamToNotExist(eventStore, addSnapshotPrefix(streamName));
  });
});
