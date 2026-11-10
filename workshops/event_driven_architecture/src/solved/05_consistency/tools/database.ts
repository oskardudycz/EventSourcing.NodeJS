import {
  getTransientFailures,
  type TransientFailures,
} from './transientFailures';

export interface DocumentsCollection<T> {
  store: (id: string, obj: T) => void;
  delete: (id: string) => void;
  get: (id: string) => T | null;
}

export interface Database {
  collection: <T>(name: string) => DocumentsCollection<T>;
  transaction: (operations: (transaction: Database) => void) => void;
}

export const getDatabase = (): Database =>
  createDatabase(
    new Map<string, unknown>(),
    getTransientFailures('Database not available!'),
  );

const createDatabase = (
  storage: Map<string, unknown>,
  failures: TransientFailures | null,
): Database => {
  const failIfUnavailable = () => failures?.failIfUnavailable();

  return {
    collection: <T>(name: string): DocumentsCollection<T> => {
      const toFullId = (id: string) => `${name}-${id}`;

      return {
        store: (id: string, obj: T): void => {
          failIfUnavailable();

          storage.set(toFullId(id), obj);
        },
        delete: (id: string): void => {
          failIfUnavailable();

          storage.delete(toFullId(id));
        },
        get: (id: string): T | null => {
          const result = storage.get(toFullId(id));

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return result
            ? // Clone to simulate getting new instance on loading
              Object.assign(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                Object.create(Object.getPrototypeOf(result)),
                result,
              )
            : null;
        },
      };
    },
    // Changes made in the operations are committed together, or not at all if the operations or the commit fail
    transaction: (operations: (transaction: Database) => void): void => {
      const transactionalStorage = new Map(storage);

      operations(createDatabase(transactionalStorage, null));

      failIfUnavailable();

      storage.clear();
      transactionalStorage.forEach((value, key) => storage.set(key, value));
    },
  };
};
