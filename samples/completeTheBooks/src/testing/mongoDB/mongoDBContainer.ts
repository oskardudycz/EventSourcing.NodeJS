import { MongoClient } from 'mongodb';
import {
  GenericContainer,
  StartedTestContainer,
  StoppedTestContainer,
} from 'testcontainers';

const MONGODB_IMAGE_NAME = 'mongo';
const MONGODB_IMAGE_TAG = '5';
const MONGODB_PORT = 27017;

// See more in https://hub.docker.com/_/mongo
export class MongoDBContainer extends GenericContainer {
  constructor(
    image = `${MONGODB_IMAGE_NAME}:${MONGODB_IMAGE_TAG}`,
    databaseName: string | undefined = undefined
  ) {
    super(image);

    if (databaseName) {
      this.withEnv('MONGO_INITDB_DATABASE', databaseName);
    }

    this.withExposedPorts(MONGODB_PORT);
  }

  async startContainer(): Promise<StartedMongoDBContainer> {
    return new StartedMongoDBContainer(await super.start());
  }
}

export class StartedMongoDBContainer {
  constructor(private container: StartedTestContainer) {}

  stop(
    options?: Partial<{
      timeout: number;
      removeVolumes: boolean;
    }>
  ): Promise<StoppedTestContainer> {
    return this.container.stop(options);
  }

  getConnectionString(): string {
    return `mongodb://${this.container.getHost()}:${this.container.getMappedPort(
      MONGODB_PORT
    )}/test`;
  }

  getClient(): MongoClient {
    return new MongoClient(this.getConnectionString());
  }
}
