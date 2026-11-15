import { getMongoDBStartedContainer } from '@event-driven-io/emmett-testcontainers';
import type { StartedMongoDBContainer } from '@testcontainers/mongodb';
import type { TestProject } from 'vitest/node';
import { dockerComposePort } from '../dockerCompose';

let container: StartedMongoDBContainer | undefined;

const connectionString = async (): Promise<string> => {
  const port = await dockerComposePort('mongodb', 27017);
  if (port !== undefined)
    return `mongodb://localhost:${port}/?directConnection=true`;

  container = await getMongoDBStartedContainer({ version: '9.0.8' });
  return container.getConnectionString();
};

export const setup = async (project: TestProject): Promise<void> => {
  project.provide('sharedMongoDBConnectionString', await connectionString());
  project.provide('keepMongoDBTestDatabases', container === undefined);
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
  container = undefined;
};
