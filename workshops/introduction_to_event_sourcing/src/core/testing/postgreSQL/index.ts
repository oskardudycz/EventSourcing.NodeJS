import { randomUUID } from 'crypto';
import pg from 'pg';
import { inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    sharedPostgreSQLConnectionString: string;
  }
}

export type PostgreSQLTestDatabase = {
  connectionString: string;
  close: () => Promise<void>;
};

const withDatabaseName = (
  serverConnectionString: string,
  databaseName: string,
): string => {
  const url = new URL(serverConnectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const onServer = async <Result>(
  handle: (client: pg.Client) => Promise<Result>,
): Promise<Result> => {
  const client = new pg.Client({
    connectionString: inject('sharedPostgreSQLConnectionString'),
  });
  await client.connect();

  try {
    return await handle(client);
  } finally {
    await client.end();
  }
};

export const sharedPostgreSQLDatabase =
  async (): Promise<PostgreSQLTestDatabase> => {
    const databaseName = `workshop_test_${randomUUID().replaceAll('-', '')}`;

    await onServer((client) =>
      client.query(`CREATE DATABASE "${databaseName}"`),
    );

    return {
      connectionString: withDatabaseName(
        inject('sharedPostgreSQLConnectionString'),
        databaseName,
      ),
      close: async () => {
        await onServer((client) =>
          client.query(`DROP DATABASE IF EXISTS "${databaseName}"`),
        );
      },
    };
  };
