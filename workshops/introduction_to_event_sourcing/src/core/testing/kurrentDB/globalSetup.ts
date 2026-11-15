import {
  EventStoreDBContainer,
  type StartedEventStoreDBContainer,
} from '@event-driven-io/emmett-testcontainers/esdb';
import type { TestProject } from 'vitest/node';
import { dockerComposePort } from '../dockerCompose';

const KURRENTDB_IMAGE =
  process.arch !== 'arm64'
    ? 'kurrentplatform/kurrentdb:26.2.3'
    : 'kurrentplatform/kurrentdb:26.2.3-experimental-arm64-10.0-noble';

let container: StartedEventStoreDBContainer | undefined;

const connectionString = async (): Promise<string> => {
  const port = await dockerComposePort('kurrentdb', 2113);
  if (port !== undefined) return `esdb://localhost:${port}?tls=false`;

  container = await new EventStoreDBContainer(KURRENTDB_IMAGE).start();
  return container.getConnectionString();
};

export const setup = async (project: TestProject): Promise<void> => {
  project.provide('sharedKurrentDBConnectionString', await connectionString());
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
  container = undefined;
};
