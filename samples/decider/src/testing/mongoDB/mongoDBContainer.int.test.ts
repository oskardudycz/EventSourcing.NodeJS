import { MongoDBContainer, StartedMongoDBContainer } from './mongoDBContainer';

describe('MongoDBContainer', () => {
  jest.setTimeout(180_000);

  let container: StartedMongoDBContainer;

  beforeAll(async () => {
    container = await new MongoDBContainer({ withoutReuse: true }).start();
  });

  it('should connect to MongoDB and store new document', async () => {
    const client = container.getClient();

    try {
      await client.connect();

      const insertResult = await client
        .db()
        .collection('test')
        .insertOne({ test: 'test' });

      expect(insertResult.acknowledged).toBeTruthy();
    } finally {
      await client.close();
    }
  });

  afterAll(async () => {
    if (container) await container.stop();
  });
});
