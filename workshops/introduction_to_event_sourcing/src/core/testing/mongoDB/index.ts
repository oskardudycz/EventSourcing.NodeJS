import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import { MongoClient } from 'mongodb';

let mongoDBContainer: StartedMongoDBContainer | undefined;
let instanceCounter = 0;

export const getMongoDBTestClient = async (
  useTestContainers = true,
): Promise<MongoClient> => {
  let connectionString;

  if (process.env.ES_USE_TEST_CONTAINERS !== 'false' && useTestContainers) {
    ++instanceCounter;
    if (!mongoDBContainer)
      mongoDBContainer = await new MongoDBContainer().start();

    connectionString = mongoDBContainer.getConnectionString();
  } else {
    connectionString = 'mongodb://localhost:27017/';
  }

  const client = new MongoClient(connectionString, {
    directConnection: true,
  });

  await client.connect();

  return client;
};

export const releaseMongoDBContainer = async () => {
  if (--instanceCounter !== 0) return;
  try {
    if (mongoDBContainer) {
      await mongoDBContainer.stop();
      mongoDBContainer = undefined;
    }
  } catch {
    // mute
  }
};
