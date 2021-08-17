import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import { setupCashRegister } from '#testing/builders/setupCashRegister';
import app from '../../app';
import { EventStoreDBClient } from '@eventstore/db-client';
import { appendToStream } from '#core/eventStore/appending';
import {
  CashierShiftEvent,
  getCurrentCashierShiftStreamName,
} from '../cashierShift';
import { getCurrentTime } from '#core/primitives';

describe('POST /cash-registers/:cashRegisterId/shifts/current', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
    console.log(config.eventStoreDB.connectionString);

    eventStore = esdbContainer.getClient();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  describe('For existing cash register', () => {
    let existingCashRegisterId: string;

    beforeEach(async () => {
      existingCashRegisterId = await setupCashRegister(app);

      const result = await appendToStream<CashierShiftEvent>(
        eventStore,
        getCurrentCashierShiftStreamName(existingCashRegisterId),
        [
          {
            type: 'cash-register-shift-initialized',
            data: {
              cashRegisterId: existingCashRegisterId,
              initializedAt: getCurrentTime(),
            },
          },
        ]
      );
      expect(result.isError).toBeFalsy();
    });

    it('should open shift', () => {
      return request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .send({ cashierId: uuid(), float: 0 })
        .expect(200)
        .expect('Content-Type', /plain/);
    });

    it('should fail to open shift if shift was already opened', async () => {
      await request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .send({ cashierId: uuid(), float: 0 })
        .expect(200);

      await request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .send({ cashierId: uuid(), float: 0 })
        .expect(412)
        .expect('Content-Type', /plain/);
    });
  });

  it('should return 404 for non existing cash register', () => {
    return request(app)
      .post('/cash-registers/NOT_EXISTING/shifts/current')
      .send({ cashierId: uuid() })
      .expect(404)
      .expect('Content-Type', /plain/);
  });
});
