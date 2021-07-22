import request from 'supertest';
import app from '../../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { setupCashRegister } from '../../testing/builders/setupCashRegister';
import { setupStartedShift } from '../../testing/builders/setupStartedShift';

describe('POST /cash-registers/:id/transactions', () => {
  let esdbContainer: StartedEventStoreDBContainer;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
    console.log(config.eventStoreDB.connectionString);
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  describe('For existing cash register', () => {
    let existingCashRegisterId: string;

    beforeEach(async () => {
      existingCashRegisterId = await setupCashRegister(app);
    });

    describe('For started shift', () => {
      beforeEach(async () => {
        await setupStartedShift(app, existingCashRegisterId);
      });

      it('should register single transaction', async () => {
        await request(app)
          .post(`/cash-registers/${existingCashRegisterId}/transactions`)
          .send({ amount: 123 })
          .expect(200)
          .expect('Content-Type', /plain/);
      });

      it('should register multiple transactions', async () => {
        await request(app)
          .post(`/cash-registers/${existingCashRegisterId}/transactions`)
          .send({ amount: 123 })
          .expect(200)
          .expect('Content-Type', /plain/);

        await request(app)
          .post(`/cash-registers/${existingCashRegisterId}/transactions`)
          .send({ amount: 123 })
          .expect('Content-Type', /plain/);
      });
    });

    describe('For not-started shift', () => {
      it('should fail to register transaction', async () => {
        await request(app)
          .post(`/cash-registers/${existingCashRegisterId}/transactions`)
          .send({ amount: 123 })
          .expect(409)
          .expect('Content-Type', /plain/);
      });
    });
  });

  it('should return 404 for non existing cash register', () => {
    return request(app)
      .post('/cash-registers/NOT_EXISTING/transactions')
      .send({ amount: 123 })
      .expect(404)
      .expect('Content-Type', /plain/);
  });
});
