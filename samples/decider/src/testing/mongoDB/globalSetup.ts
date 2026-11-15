import type { StartedMongoDBContainer } from '@testcontainers/mongodb';
import { MongoDBContainer } from '@testcontainers/mongodb';
import type { TestProject } from 'vitest/node';
import { dockerComposePort } from '../dockerCompose';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoDBConnectionString: string;
  }
}

let container: StartedMongoDBContainer | undefined;

const connectionString = async (): Promise<string> => {
  const port = await dockerComposePort('mongodb', 27017);
  if (port !== undefined)
    return `mongodb://localhost:${port}/?directConnection=true`;

  container = await new MongoDBContainer('mongo:9.0.8').start();
  return container.getConnectionString();
};

export const setup = async (project: TestProject): Promise<void> => {
  project.provide('mongoDBConnectionString', await connectionString());
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
};
