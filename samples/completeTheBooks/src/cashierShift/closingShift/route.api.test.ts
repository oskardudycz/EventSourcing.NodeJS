import request from 'supertest';
import { EventStoreDBClient } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import { toWeakETag } from '#core/http/requests';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '#testing/eventStoreDB/eventStoreDBContainer';
import app from '../../app';
import {
  setupInitiatedCashierShift,
  setupStartedCashierShift,
} from '#testing/builders/byEvents';

describe('DELETE /cash-registers/:cashRegisterId/shifts/current', () => {
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
    let currentRevision: string;

    beforeEach(async () => {
      existingCashRegisterId = uuid();

      const result = await setupInitiatedCashierShift(
        eventStore,
        existingCashRegisterId
      );
      currentRevision = toWeakETag(result.nextExpectedRevision);
    });

    it('should return 409 for not open shift cash register', () => {
      return request(app)
        .delete(`/cash-registers/${existingCashRegisterId}/shifts/current`)
        .expect(409)
        .set('If-Match', currentRevision)
        .expect('Content-Type', /json/);
    });

    describe('For opened shift', () => {
      beforeEach(async () => {
        const result = await setupStartedCashierShift(
          eventStore,
          existingCashRegisterId
        );
        currentRevision = toWeakETag(result.nextExpectedRevision);
      });

      it('should close shift', async () => {
        return request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts/current`)
          .expect(200)
          .set('If-Match', currentRevision)
          .expect('Content-Type', /plain/);
      });

      it('should fail to close shift if shift was already closed', async () => {
        await request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts/current`)
          .expect(200)
          .set('If-Match', currentRevision)
          .expect('Content-Type', /plain/)
          .then((response) => {
            currentRevision = response.headers['etag'];
          });

        await request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts/current`)
          .set('If-Match', currentRevision)
          .expect(409)
          .expect('Content-Type', /json/);
      });

      it('should fail to close shift if current revision is not sent in If-Match', async () => {
        return request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts/current`)
          .expect(400)
          .expect('Content-Type', /json/);
      });

      it('should fail to close shift if current revision is not the current one', async () => {
        return request(app)
          .delete(`/cash-registers/${existingCashRegisterId}/shifts/current`)
          .set('If-Match', toWeakETag(123456789))
          .expect(412)
          .expect('Content-Type', /json/);
      });
    });
  });

  it('should return 404 for non existing cash register', () => {
    const notExistingId = 'NOT_EXISTING';
    return request(app)
      .delete(`/cash-registers/${notExistingId}/shifts/current`)
      .set('If-Match', toWeakETag(1))
      .expect(404)
      .expect('Content-Type', /json/);
  });
});
