import { JSONSerializer } from '@event-driven-io/emmett';

export interface DocumentsCollection<T> {
  store: (id: string, obj: T) => Promise<void>;
  delete: (id: string) => Promise<void>;
  get: (id: string) => Promise<T | null>;
  findAll: () => Promise<T[]>;
}

export interface Database {
  collection: <T extends object>(
    name: string,
    type?: new () => T,
  ) => DocumentsCollection<T>;
}

export const getDatabase = (): Database => {
  const storage = new Map<string, string>();

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
        store: (id: string, obj: T): Promise<void> => {
          storage.set(toFullId(id), JSONSerializer.serialize(obj));

          return Promise.resolve();
        },
        delete: (id: string): Promise<void> => {
          storage.delete(toFullId(id));

          return Promise.resolve();
        },
        get: (id: string): Promise<T | null> => {
          const json = storage.get(toFullId(id));

          return Promise.resolve(json !== undefined ? load(json) : null);
        },
        findAll: (): Promise<T[]> =>
          Promise.resolve(
            [...storage.entries()]
              .filter(([fullId]) => fullId.startsWith(`${name}-`))
              .map(([, json]) => load(json)),
          ),
      };
    },
  };
};
