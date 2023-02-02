import { MongoClient } from 'mongodb';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { AbstractStartedContainer } from 'testcontainers/dist/modules/abstract-started-container';

const MONGODB_IMAGE_NAME = 'mongo';
const MONGODB_IMAGE_TAG = '6.0.4';
const MONGODB_PORT = 27017;

// See more in https://hub.docker.com/_/mongo
export class MongoDBContainer extends GenericContainer {
  constructor({
    image,
    databaseName,
    withoutReuse,
  }: {
    image?: string;
    databaseName?: string;
    withoutReuse?: boolean;
  } = {}) {
    super(image ?? `${MONGODB_IMAGE_NAME}:${MONGODB_IMAGE_TAG}`);

    if (databaseName) {
      this.withEnvironment({ MONGO_INITDB_DATABASE: databaseName });
    }

    this.withExposedPorts(MONGODB_PORT);

    if (!withoutReuse) this.withReuse();
  }

  async start(): Promise<StartedMongoDBContainer> {
    return new StartedMongoDBContainer(await super.start());
  }
}

export class StartedMongoDBContainer extends AbstractStartedContainer {
  constructor(container: StartedTestContainer) {
    super(container);
  }

  getConnectionString(): string {
    return `mongodb://${this.getHost()}:${this.getMappedPort(
      MONGODB_PORT
    )}/test`;
  }

  getClient(): MongoClient {
    return new MongoClient(this.getConnectionString());
  }
}
