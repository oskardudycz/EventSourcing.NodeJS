import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { StartedTestContainer } from 'testcontainers';
import { AbstractStartedContainer, GenericContainer } from 'testcontainers';
import type { Environment } from 'testcontainers/build/types';

const KURRENTDB_PORT = 2113;
const KURRENTDB_TCP_PORTS = [KURRENTDB_PORT];
const KURRENTDB_IMAGE_NAME = 'kurrentplatform/kurrentdb';
const KURRENTDB_IMAGE_TAG = '26.2.3';

export class KurrentDBContainer extends GenericContainer {
  private readonly tcpPorts = KURRENTDB_TCP_PORTS;

  constructor(
    image = `${KURRENTDB_IMAGE_NAME}:${KURRENTDB_IMAGE_TAG}`,
    runProjections = true,
    isInsecure = true,
    emptyDatabase = true,
    withoutReuse = false,
  ) {
    super(image);

    const environment: Environment = {
      ...(runProjections
        ? {
            KURRENTDB_RUN_PROJECTIONS: 'ALL',
          }
        : {}),
      ...(isInsecure
        ? {
            KURRENTDB_INSECURE: 'true',
          }
        : {}),
      ...(!emptyDatabase
        ? {
            KURRENTDB_MEM_DB: 'false',
            KURRENTDB_DB: '/data/integration-tests',
          }
        : {}),
      KURRENTDB_CLUSTER_SIZE: '1',
      KURRENTDB_START_STANDARD_PROJECTIONS: 'true',
      KURRENTDB_NODE_PORT: `${KURRENTDB_PORT}`,
      KURRENTDB_ENABLE_ATOM_PUB_OVER_HTTP: 'true',
    };

    this.withEnvironment(environment).withExposedPorts(...this.tcpPorts);

    if (!withoutReuse) this.withReuse();
  }

  async start(): Promise<StartedKurrentDBContainer> {
    return new StartedKurrentDBContainer(await super.start());
  }
}

export class StartedKurrentDBContainer extends AbstractStartedContainer {
  constructor(container: StartedTestContainer) {
    super(container);
  }

  getConnectionString(): string {
    return `kurrentdb://${this.getHost()}:${this.getMappedPort(
      2113,
    )}?tls=false&throwOnAppendFailure=false`;
  }

  getClient(): KurrentDBClient {
    return KurrentDBClient.connectionString(this.getConnectionString());
  }
}
