import request from 'supertest';
import app from '../../app';
import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '../../testing/eventStoreDB/eventStoreDBContainer';
import { config } from '../../../config';
import isUUID from 'validator/lib/isUUID';

describe('POST /cash-register/', () => {
  let esdbContainer: StartedEventStoreDBContainer;

  beforeAll(async () => {
    esdbContainer = await new EventStoreDBContainer().startContainer();
    config.eventStoreDB.connectionString = esdbContainer.getConnectionString();
  });

  afterAll(async () => {
    await esdbContainer.stop();
  });

  it('should place cash register at work station', async () => {
    return await request(app)
      .post('/cash-registers/')
      .send({ workstation: 'WS#1' })
      .expect(201)
      .expect('Content-Type', /json/)
      .expect(async (res) => {
        expect(res.body).toHaveProperty('id');
        expect(isUUID(res.body.id)).toBeTruthy();

        expect(res.headers['location']).toBeDefined();
        expect(res.headers['location']).toBe(`/cash-registers/${res.body.id}`);
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
