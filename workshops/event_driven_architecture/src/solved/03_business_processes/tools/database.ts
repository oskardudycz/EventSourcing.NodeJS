import { JSONSerializer } from '@event-driven-io/emmett';

export interface DocumentsCollection<T> {
  store: (id: string, obj: T) => void;
  delete: (id: string) => void;
  get: (id: string) => T | null;
  findAll: () => T[];
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
        store: (id: string, obj: T): void => {
          storage.set(toFullId(id), JSONSerializer.serialize(obj));
        },
        delete: (id: string): void => {
          storage.delete(toFullId(id));
        },
        get: (id: string): T | null => {
          const json = storage.get(toFullId(id));

          return json !== undefined ? load(json) : null;
        },
        findAll: (): T[] =>
          [...storage.entries()]
            .filter(([fullId]) => fullId.startsWith(`${name}-`))
            .map(([, json]) => load(json)),
      };
    },
  };
};
