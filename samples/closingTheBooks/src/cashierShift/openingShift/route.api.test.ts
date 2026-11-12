import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import app from '../../app';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { setupInitiatedCashierShift } from '#testing/builders/byEvents/setupInitiatedCashierShift';
import { toWeakETag } from '#core/http/requests';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

describe('POST /cash-registers/:cashRegisterId/shifts/current', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;
  let eventStore: KurrentDBClient;

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();
    console.log(config.kurrentDB.connectionString);

    eventStore = kurrentDBContainer.getClient();
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
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
