import { getEventStore } from '#core/eventStore';
import { config } from '../../../config';
import type { EndShift } from './handler';
import { handleEndShift } from './handler';
import type { PlaceAtWorkStation } from '../placeAtWorkStation/handler';
import { handlePlaceAtWorkStation } from '../placeAtWorkStation/handler';
import { v4 as uuid } from 'uuid';
import { addCashRegister, updateCashRegister } from '../processCashRegister';
import { getCashRegisterStreamName } from '../cashRegister';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { addSnapshotPrefix } from '#core/eventStore/snapshotting';
import { expectStreamToHaveNumberOfEvents } from '../../testing/assertions/streams';
import type { StartShift } from '../startingShift';
import { handleStartShift } from '../startingShift';
import type { RegisterTransaction } from '../registeringTransaction';
import { handleRegisterTransaction } from '../registeringTransaction';
import { beforeAll, describe, expect, inject, it } from 'vitest';

describe('EndShift command', () => {
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();
  const streamName = getCashRegisterStreamName(cashRegisterId);

  beforeAll(async () => {
    config.kurrentDB.connectionString = inject('kurrentDBConnectionString');

    eventStore = getEventStore();

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
