import type { TestProject } from 'vitest/node';
import { dockerComposePort } from '../dockerCompose';
import type { StartedKurrentDBContainer } from './kurrentDBContainer';
import { KurrentDBContainer } from './kurrentDBContainer';

declare module 'vitest' {
  export interface ProvidedContext {
    kurrentDBConnectionString: string;
  }
}

let container: StartedKurrentDBContainer | undefined;

const connectionString = async (): Promise<string> => {
  const port = await dockerComposePort('kurrentdb', 2113);
  if (port !== undefined)
    return `kurrentdb://localhost:${port}?tls=false&throwOnAppendFailure=false`;

  container = await new KurrentDBContainer().start();
  return container.getConnectionString();
};

export const setup = async (project: TestProject): Promise<void> => {
  project.provide('kurrentDBConnectionString', await connectionString());
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
};
