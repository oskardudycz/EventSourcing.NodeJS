import request from 'supertest';
import app from '../../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { setupCashRegister } from '../../testing/builders/setupCashRegister';
import { setupStartedShift } from '../../testing/builders/setupStartedShift';

describe('DELETE /cash-registers/:id/shifts', () => {
  let esdbContainer: StartedEventStoreDBContainer;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().start();
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

      it('should end shift', async () => {
        return request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts`)
          .expect(200)
          .expect('Content-Type', /plain/);
      });

      it('should fail to end shift if shift was already ended', async () => {
        await request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts`)
          .expect(200);

        await request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts`)
          .expect(409)
          .expect('Content-Type', /plain/);
      });
    });
  });

  it('should return 404 for non existing cash register', () => {
    return request(app)
      .delete('/cash-registers/NOT_EXISTING/shifts')
      .expect(404)
      .expect('Content-Type', /plain/);
  });
});
