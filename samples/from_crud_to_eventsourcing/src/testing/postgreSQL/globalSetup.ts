import { getPostgreSQLStartedContainer } from '@event-driven-io/emmett-testcontainers';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { dockerComposePort } from '../dockerCompose';

declare module 'vitest' {
  export interface ProvidedContext {
    postgreSQLConnectionString: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

const connectionString = async (): Promise<string> => {
  const port = await dockerComposePort('postgres', 5432);
  if (port !== undefined)
    return `postgres://postgres:postgres@localhost:${port}/postgres`;

  container = await getPostgreSQLStartedContainer({ version: '18.7-alpine' });
  return container.getConnectionUri();
};

export const setup = async (project: TestProject): Promise<void> => {
  project.provide('postgreSQLConnectionString', await connectionString());
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
};
