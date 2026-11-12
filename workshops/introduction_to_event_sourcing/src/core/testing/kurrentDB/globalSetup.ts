import {
  EventStoreDBContainer,
  type StartedEventStoreDBContainer,
} from '@event-driven-io/emmett-testcontainers/esdb';
import type { TestProject } from 'vitest/node';

const KURRENTDB_IMAGE =
  process.arch !== 'arm64'
    ? 'kurrentplatform/kurrentdb:26.2.3'
    : 'kurrentplatform/kurrentdb:26.2.3-experimental-arm64-10.0-noble';

let container: StartedEventStoreDBContainer | undefined;

export const setup = async (project: TestProject): Promise<void> => {
  container = await new EventStoreDBContainer(KURRENTDB_IMAGE).start();

  project.provide(
    'sharedKurrentDBConnectionString',
    container.getConnectionString(),
  );
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
  container = undefined;
};
