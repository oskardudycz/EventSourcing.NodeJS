import request from 'supertest';
import app from '../../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import { v4 as uuid } from 'uuid';
import { setupCashRegister } from '../../testing/builders/setupCashRegister';

describe('POST /cash-registers/:id/shifts', () => {
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
