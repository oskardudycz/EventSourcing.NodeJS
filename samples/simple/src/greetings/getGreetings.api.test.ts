import request from 'supertest';
import app from '../app';
import { describe, it } from 'vitest';

describe('GET /', () => {
  it('should return greeting "Hello World!"', () => {
    return request(app)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200, { greeting: 'Hello World!' });
  });
});
