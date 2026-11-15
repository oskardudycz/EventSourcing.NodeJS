import { getPostgreSQLStartedContainer } from '@event-driven-io/emmett-testcontainers';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { dockerComposePort } from '../dockerCompose';

let container: StartedPostgreSqlContainer | undefined;

const connectionString = async (): Promise<string> => {
  const port = await dockerComposePort('postgres', 5432);
  if (port !== undefined)
    return `postgresql://postgres:postgres@localhost:${port}/postgres`;

  container = await getPostgreSQLStartedContainer({ version: '18.7-alpine' });
  return container.getConnectionUri();
};

export const setup = async (project: TestProject): Promise<void> => {
  project.provide('sharedPostgreSQLConnectionString', await connectionString());
  project.provide('keepPostgreSQLTestDatabases', container === undefined);
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
  container = undefined;
};
