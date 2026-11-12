import request from 'supertest';
import app from '../../app';
import type { StartedKurrentDBContainer } from '../../testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '../../testing/kurrentDB/kurrentDBContainer';
import { config } from '../../../config';
import { v4 as uuid } from 'uuid';
import { setupCashRegister } from '../../testing/builders/setupCashRegister';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

describe('POST /cash-registers/:id/shifts', () => {
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

    it('should start shift', () => {
      return request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts`)
        .send({ cashierId: uuid() })
        .expect(200)
        .expect('Content-Type', /plain/);
    });

    it('should fail to start shift if shift was already started', async () => {
      await request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts`)
        .send({ cashierId: uuid() })
        .expect(200);

      await request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts`)
        .send({ cashierId: uuid() })
        .expect(409)
        .expect('Content-Type', /plain/);
    });
  });

  it('should return 404 for non existing cash register', () => {
    return request(app)
      .post('/cash-registers/NOT_EXISTING/shifts')
      .send({ cashierId: uuid() })
      .expect(404)
      .expect('Content-Type', /plain/);
  });
});
