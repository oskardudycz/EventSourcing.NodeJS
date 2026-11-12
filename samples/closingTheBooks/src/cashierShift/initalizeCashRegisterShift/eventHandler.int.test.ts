import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { expectStreamToHaveNumberOfEvents } from '#testing/assertions/streams';
import { handleCashRegisterPlacedAtWorkStation } from './eventHandler';
import { getCurrentTime } from '#core/primitives';
import type { PlacedAtWorkStation } from '../../cashRegisters/placeAtWorkStation';
import { getCurrentCashierShiftStreamName } from '../cashierShift';
import { getCashRegisterStreamName } from '../../cashRegisters/cashRegister';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('PlacedAtWorkStation event', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let eventStore: KurrentDBClient;
  const cashRegisterId = uuid();

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();

    eventStore = kurrentDBContainer.getClient();
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
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
      1,
    );
  });
});
