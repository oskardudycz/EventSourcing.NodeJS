import { EventStoreDBClient } from '@eventstore/db-client';
import {
  GenericContainer,
  StartedTestContainer,
  StoppedTestContainer,
} from 'testcontainers';

const EVENTSTOREDB_PORT = 2113;
const EVENTSTOREDB_TCP_PORT = 1113;
const EVENTSTOREDB_TCP_PORTS = [EVENTSTOREDB_TCP_PORT, EVENTSTOREDB_PORT];
const EVENTSTOREDB_IMAGE_NAME = 'eventstore/eventstore';
const EVENTSTOREDB_IMAGE_TAG = '20.10.4-buster-slim';

export class EventStoreDBContainer extends GenericContainer {
  private readonly tcpPorts = EVENTSTOREDB_TCP_PORTS;

  constructor(
    image = `${EVENTSTOREDB_IMAGE_NAME}:${EVENTSTOREDB_IMAGE_TAG}`,
    runProjections = true,
    isInsecure = true,
    emptyDatabase = true
  ) {
    super(image);

    if (runProjections) {
      this.withEnv('EVENTSTORE_RUN_PROJECTIONS', 'ALL');
    }

    if (isInsecure) {
      this.withEnv('EVENTSTORE_INSECURE', 'true');
    }

    if (!emptyDatabase) {
      this.withEnv('EVENTSTORE_MEM_DB', 'false').withEnv(
        'EVENTSTORE_DB',
        '/data/integration-tests'
      );
    }

    this.withEnv('EVENTSTORE_CLUSTER_SIZE', '1')
      .withEnv('EVENTSTORE_START_STANDARD_PROJECTIONS', 'true')
      .withEnv('EVENTSTORE_EXT_TCP_PORT', `${EVENTSTOREDB_TCP_PORT}`)
      .withEnv('EVENTSTORE_EXT_HTTP_PORT', `${EVENTSTOREDB_PORT}`)
      .withEnv('EVENTSTORE_ENABLE_EXTERNAL_TCP', 'true')
      .withEnv('EVENTSTORE_ENABLE_ATOM_PUB_OVER_HTTP', 'true')
      .withExposedPorts(...this.tcpPorts);
  }

  async startContainer(): Promise<StartedEventStoreDBContainer> {
    return new StartedEventStoreDBContainer(await super.start());
  }
}

export class StartedEventStoreDBContainer {
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
    return `esdb://${this.container.getHost()}:${this.container.getMappedPort(
      2113
    )}?tls=false&throwOnAppendFailure=false`;
  }

  getClient(): EventStoreDBClient {
    return EventStoreDBClient.connectionString(this.getConnectionString());
  }
}
