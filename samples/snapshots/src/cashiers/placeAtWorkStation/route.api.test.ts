import request from 'supertest';
import app from '../../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';

describe('POST /cash-register/', () => {
  let esdbContainer: StartedEventStoreDBContainer;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should place cash register at work station', () => {
    return request(app)
      .post('/cash-registers/')
      .send({ workstation: 'WS#1' })
      .set('Accept', 'application/json')
      .expect(201)
      .expect('Content-Type', /json/);
  });
});
