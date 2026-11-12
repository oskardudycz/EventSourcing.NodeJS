import { randomUUID } from 'crypto';
import { MongoClient } from 'mongodb';
import { inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    sharedMongoDBConnectionString: string;
  }
}

export type MongoDBTestDatabase = {
  client: MongoClient;
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

export const sharedMongoDBDatabase = async (): Promise<MongoDBTestDatabase> => {
  const databaseName = `workshop_test_${randomUUID().replaceAll('-', '')}`;

  const client = new MongoClient(
    withDatabaseName(inject('sharedMongoDBConnectionString'), databaseName),
    { directConnection: true },
  );
  await client.connect();

  return {
    client,
    close: async () => {
      try {
        await client.db().dropDatabase();
      } finally {
        await client.close();
      }
    },
  };
};
