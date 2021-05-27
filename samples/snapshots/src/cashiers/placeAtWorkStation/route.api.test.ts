import request from 'supertest';
import app from '../../app';

describe('POST /cash-register/', () => {
  it('should place cash register at work station', () => {
    return request(app)
      .post('/cash-registers/')
      .send({ workstation: 'WS#1' })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(201);
  });
});
