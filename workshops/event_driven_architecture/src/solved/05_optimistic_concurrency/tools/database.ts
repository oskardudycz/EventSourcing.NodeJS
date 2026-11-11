import { ConcurrencyError } from './concurrencyError';

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
  collection: <T>(name: string) => DocumentsCollection<T>;
}

export const getDatabase = (): Database => {
  const storage = new Map<string, Versioned<unknown>>();

  return {
    collection: <T>(name: string): DocumentsCollection<T> => {
      const toFullId = (id: string) => `${name}-${id}`;

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
            document: clone(document),
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
                  // Clone to simulate getting new instance on loading
                  document: clone(result.document) as T,
                  version: result.version,
                }
              : null,
          );
        },
      };
    },
  };
};
