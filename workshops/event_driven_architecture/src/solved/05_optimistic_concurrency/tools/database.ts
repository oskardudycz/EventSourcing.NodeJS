import { JSONSerializer } from '@event-driven-io/emmett';
import { ConcurrencyError } from './concurrencyError';

export type Versioned<T> = { document: T; version: number };

export interface DocumentsCollection<T> {
  store: (
    id: string,
    document: T,
    options?: { expectedVersion?: number },
  ) => Promise<void>;
  delete: (id: string) => Promise<void>;
  get: (id: string) => Promise<Versioned<T> | null>;
}

export interface Database {
  collection: <T extends object>(
    name: string,
    type?: new () => T,
  ) => DocumentsCollection<T>;
}

export const getDatabase = (): Database => {
  const storage = new Map<string, Versioned<string>>();

  return {
    collection: <T extends object>(
      name: string,
      type?: new () => T,
    ): DocumentsCollection<T> => {
      const toFullId = (id: string) => `${name}-${id}`;
      const load = (json: string): T => {
        const data = JSONSerializer.deserialize<T>(json, {
          parseDates: true,
        });

        return type ? Object.assign(new type(), data) : data;
      };

      return {
        store: (
          id: string,
          document: T,
          options?: { expectedVersion?: number },
        ): Promise<void> => {
          const currentVersion = storage.get(toFullId(id))?.version ?? 0;
          const expectedVersion = options?.expectedVersion;

          if (
            expectedVersion !== undefined &&
            expectedVersion !== currentVersion
          )
            return Promise.reject(
              new ConcurrencyError(
                `Expected version ${expectedVersion} of ${name} '${id}', but it's ${currentVersion}`,
              ),
            );

          storage.set(toFullId(id), {
            document: JSONSerializer.serialize(document),
            version: currentVersion + 1,
          });

          return Promise.resolve();
        },
        delete: (id: string): Promise<void> => {
          storage.delete(toFullId(id));

          return Promise.resolve();
        },
        get: (id: string): Promise<Versioned<T> | null> => {
          const result = storage.get(toFullId(id));

          return Promise.resolve(
            result
              ? {
                  document: load(result.document),
                  version: result.version,
                }
              : null,
          );
        },
      };
    },
  };
};
