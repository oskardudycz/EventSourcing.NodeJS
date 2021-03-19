import request from 'supertest';
import app from '../app';

describe('GET /', () => {
  it('should return greeting "Hello World!"', () => {
    return request(app)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200, { greeting: 'Hello World!' });
  });
});
