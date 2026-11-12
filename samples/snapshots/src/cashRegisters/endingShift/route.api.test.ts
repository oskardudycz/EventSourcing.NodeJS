import request from 'supertest';
import app from '../../app';
import type { StartedKurrentDBContainer } from '../../testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '../../testing/kurrentDB/kurrentDBContainer';
import { config } from '../../../config';
import { setupCashRegister } from '../../testing/builders/setupCashRegister';
import { setupStartedShift } from '../../testing/builders/setupStartedShift';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

describe('DELETE /cash-registers/:id/shifts', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();
    console.log(config.kurrentDB.connectionString);
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
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
