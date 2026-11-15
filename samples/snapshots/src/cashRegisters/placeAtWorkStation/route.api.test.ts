import request from 'supertest';
import app from '../../app';
import { config } from '../../../config';
import isUUID from 'validator/lib/isUUID';
import { beforeAll, describe, expect, inject, it } from 'vitest';

describe('POST /cash-register/', () => {
  beforeAll(() => {
    config.kurrentDB.connectionString = inject('kurrentDBConnectionString');
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
