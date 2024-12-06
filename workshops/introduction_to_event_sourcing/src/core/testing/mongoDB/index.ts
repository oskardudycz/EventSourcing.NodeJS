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

  if (useTestContainers) {
    ++instanceCounter;
    if (!mongoDBContainer)
      mongoDBContainer = await new MongoDBContainer().start();

    connectionString = mongoDBContainer.getConnectionString();
  } else {
    connectionString = 'mongodb://mongodb:27017/';
  }

  return new MongoClient(connectionString, {
    directConnection: true,
  });
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
