import request from 'supertest';
import { v4 as uuid } from 'uuid';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { config } from '#config';
import app from '../../app';
import {
  setupInitiatedCashierShift,
  setupOpenedCashierShift,
} from '#testing/builders/byEvents';
import { toWeakETag } from '#core/http/requests';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

describe('POST /cash-registers/:cashRegisterId/shifts/current/transactions', () => {
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

    describe('For opened shift', () => {
      beforeEach(async () => {
        const result = await setupOpenedCashierShift(
          eventStore,
          existingCashRegisterId,
        );
        currentRevision = toWeakETag(result.nextExpectedRevision);
      });

      it('should register single transaction', async () => {
        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .set('If-Match', currentRevision)
          .expect(200)
          .expect('Content-Type', /plain/);
      });

      it('should register multiple transactions', async () => {
        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .set('If-Match', currentRevision)
          .expect(200)
          .expect('Content-Type', /plain/)
          .then((response) => {
            currentRevision = response.headers['etag'];
          });

        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .expect(200)
          .set('If-Match', currentRevision)
          .expect('Content-Type', /plain/);
      });

      it('should fail to register transaction if current revision is not sent in If-Match', async () => {
        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .expect(400)
          .expect('Content-Type', /json/);
      });

      it('should fail to register multiple transactions with the same revision', async () => {
        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .set('If-Match', currentRevision)
          .expect(200)
          .expect('Content-Type', /plain/);

        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .expect(412)
          .set('If-Match', currentRevision)
          .expect('Content-Type', /json/);
      });
    });

    describe('For not-opened shift', () => {
      it('should fail to register transaction', async () => {
        await request(app)
          .post(
            `/cash-registers/${existingCashRegisterId}/shifts/current/transactions`,
          )
          .send({ amount: 123 })
          .set('If-Match', currentRevision)
          .expect(409)
          .expect('Content-Type', /json/);
      });
    });
  });

  it('should return 404 for non existing cash register', () => {
    return request(app)
      .post('/cash-registers/:cashRegisterId/shifts/current/transactions')
      .send({ amount: 123 })
      .set('If-Match', toWeakETag(0))
      .expect(404)
      .expect('Content-Type', /json/);
  });
});
