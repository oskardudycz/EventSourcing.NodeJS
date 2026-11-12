import { ConcurrencyError } from './concurrencyError';
import { getTransientFailures } from './transientFailures';

// structuredClone drops the class, so the prototype is restored to keep aggregate methods
const clone = <T>(document: T): T => {
  const copy = structuredClone(document);

  if (typeof document !== 'object' || document === null) return copy;

  return Object.setPrototypeOf(
    copy,
    Object.getPrototypeOf(document) as object | null,
  ) as T;
};

export type Versioned<T> = { document: T; version: number };

export type Stored<T> = Versioned<T> & { id: string; position: number };

export interface DocumentsCollection<T> {
  store: (
    id: string,
    document: T,
    options?: { expectedVersion?: number },
  ) => Promise<void>;
  delete: (id: string) => Promise<void>;
  get: (id: string) => Promise<Versioned<T> | null>;
  // Returns documents in the order they were stored, each store gets the next position
  getAll: () => Promise<Stored<T>[]>;
}

export interface Database {
  collection: <T>(name: string) => DocumentsCollection<T>;
  transaction: <Result>(
    operations: (transaction: Database) => Promise<Result>,
  ) => Promise<Result>;
}

type Storage = {
  documents: Map<string, StoredDocument>;
  lastPosition: number;
};

type StoredDocument = Stored<unknown> & { collection: string };

type Write =
  | {
      type: 'store';
      collection: string;
      id: string;
      document: unknown;
      expectedVersion: number | undefined;
    }
  | { type: 'delete' };

export const getDatabase = (): Database => {
  const storage: Storage = { documents: new Map(), lastPosition: 0 };
  const failures = getTransientFailures('Database not available!');

  const commit = (writes: Map<string, Write>): void => {
    for (const [key, write] of writes) {
      if (write.type === 'store')
        checkVersion(storage, key, write.expectedVersion);
    }

    for (const [key, write] of writes) {
      if (write.type === 'store')
        storage.documents.set(key, {
          collection: write.collection,
          id: write.id,
          document: clone(write.document),
          version: (storage.documents.get(key)?.version ?? 0) + 1,
          position: ++storage.lastPosition,
        });
      else storage.documents.delete(key);
    }
  };

  const database: Database = {
    collection: <T>(name: string): DocumentsCollection<T> =>
      collection<T>(name, storage, (key, write) => {
        failures.failIfUnavailable();
        commit(new Map([[key, write]]));
      }),
    transaction: async <Result>(
      operations: (transaction: Database) => Promise<Result>,
    ): Promise<Result> => {
      const writes = new Map<string, Write>();

      const transaction: Database = {
        collection: <T>(name: string): DocumentsCollection<T> =>
          collection<T>(name, storage, (key, write) => {
            writes.set(key, write);
          }),
        transaction: (nested) => nested(transaction),
      };

      const result = await operations(transaction);

      // Changes made in the operations are committed together, or not at all if the operations or the commit fail
      failures.failIfUnavailable();
      commit(writes);

      return result;
    },
  };

  return database;
};

const collection = <T>(
  name: string,
  storage: Storage,
  write: (key: string, write: Write) => void,
): DocumentsCollection<T> => {
  const toFullId = (id: string) => `${name}-${id}`;

  return {
    store: (
      id: string,
      document: T,
      options?: { expectedVersion?: number },
    ): Promise<void> => {
      try {
        write(toFullId(id), {
          type: 'store',
          collection: name,
          id,
          document,
          expectedVersion: options?.expectedVersion,
        });
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },
    delete: (id: string): Promise<void> => {
      try {
        write(toFullId(id), { type: 'delete' });
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },
    get: (id: string): Promise<Versioned<T> | null> => {
      const result = storage.documents.get(toFullId(id));

      return Promise.resolve(
        result
          ? {
              // Clone to simulate getting new instance on loading
              document: clone(result.document) as T,
              version: result.version,
            }
          : null,
      );
    },
    getAll: (): Promise<Stored<T>[]> =>
      Promise.resolve(
        [...storage.documents.values()]
          .filter((stored) => stored.collection === name)
          .sort((a, b) => a.position - b.position)
          .map(({ id, document, version, position }) => ({
            id,
            document: clone(document) as T,
            version,
            position,
          })),
      ),
  };
};

const checkVersion = (
  storage: Storage,
  key: string,
  expectedVersion: number | undefined,
): void => {
  const currentVersion = storage.documents.get(key)?.version ?? 0;

  if (expectedVersion !== undefined && expectedVersion !== currentVersion)
    throw new ConcurrencyError(
      `Expected version ${expectedVersion} of '${key}', but it's ${currentVersion}`,
    );
};
