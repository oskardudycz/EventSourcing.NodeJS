import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import app from '../../app';
import { EventStoreDBClient } from '@eventstore/db-client';
import { setupInitiatedCashierShift } from '#testing/builders/byEvents/setupInitiatedCashierShift';
import { toWeakETag } from '#core/http/requests';

describe('POST /cash-registers/:cashRegisterId/shifts/current', () => {
  let esdbContainer: StartedEventStoreDBContainer;
  let eventStore: EventStoreDBClient;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().start();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
    console.log(config.eventStoreDB.connectionString);

    eventStore = esdbContainer.getClient();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  describe('For existing cash register', () => {
    let existingCashRegisterId: string;
    let currentRevision: string;

    beforeEach(async () => {
      existingCashRegisterId = uuid();

      const result = await setupInitiatedCashierShift(
        eventStore,
        existingCashRegisterId,
      );
      currentRevision = toWeakETag(result.nextExpectedRevision);
    });

    it('should open shift', () => {
      return request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .send({ cashierId: uuid(), float: 0 })
        .set('If-Match', currentRevision)
        .expect(200)
        .expect('Content-Type', /plain/);
    });

    it('should fail to open shift if shift was already opened', async () => {
      await request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .send({ cashierId: uuid(), float: 0 })
        .set('If-Match', currentRevision)
        .expect(200)
        .expect('Content-Type', /plain/)
        .then((response) => {
          currentRevision = response.headers['etag'];
        });

      await request(app)
        .post(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .send({ cashierId: uuid(), float: 0 })
        .set('If-Match', currentRevision)
        .expect(409)
        .expect('Content-Type', /json/);
    });
  });

  it('should return 404 for non existing cash register', () => {
    const notExistingId = 'NOT_EXISTING';
    return request(app)
      .post(`/cash-registers/${notExistingId}/shifts/current`)
      .send({ cashierId: uuid(), float: 0 })
      .set('If-Match', toWeakETag(0))
      .expect(404)
      .expect('Content-Type', /json/);
  });
});
