import request from 'supertest';
import isUUID from 'validator/lib/isUUID';
import type { StartedKurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { KurrentDBContainer } from '#testing/kurrentDB/kurrentDBContainer';
import { config } from '#config';
import app from '../../app';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('POST /cash-register/', () => {
  let kurrentDBContainer: StartedKurrentDBContainer;

  beforeAll(async () => {
    kurrentDBContainer = await new KurrentDBContainer().start();
    config.kurrentDB.connectionString =
      kurrentDBContainer.getConnectionString();
  });

  afterAll(async () => {
    await kurrentDBContainer.stop();
  });

  it('should place cash register at work station', async () => {
    return await request(app)
      .post('/cash-registers/')
      .send({ workstation: 'WS#1' })
      .expect(201)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const body = res.body as { id: string };
        expect(body).toHaveProperty('id');
        expect(isUUID(body.id)).toBeTruthy();

        expect(res.headers['location']).toBeDefined();
        expect(res.headers['location']).toBe(`/cash-registers/${body.id}`);

        expect(res.headers['etag']).toBeDefined();
        expect(res.headers['etag']).toMatch(/W\/"\d+.*"/);
      });
  });

  it('should return 400 for missing work station', () => {
    return request(app)
      .post('/cash-registers/')
      .send({})
      .expect(400)
      .expect('Content-Type', /json/);
  });
});
