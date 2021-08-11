import request from 'supertest';
import app from '../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../testing/eventStoreDB/eventStoreDBContainer';
import { setupCashRegister } from '../testing/builders/setupCashRegister';
import { config } from '#config';
import { v4 as uuid } from 'uuid';

describe('Full flow', () => {
  let esdbContainer: StartedEventStoreDBContainer;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
    console.log(config.eventStoreDB.connectionString);
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  describe('when cash register was placed at workstation', () => {
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
});
