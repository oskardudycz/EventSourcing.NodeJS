export interface DocumentsCollection<T> {
  store: (id: string, obj: T) => void;
  delete: (id: string) => void;
  get: (id: string) => T | null;
}

export interface Database {
  collection: <T>(name: string) => DocumentsCollection<T>;
}

export const getDatabase = (): Database => {
  const storage = new Map<string, unknown>();

  return {
    collection: <T>(name: string): DocumentsCollection<T> => {
      const toFullId = (id: string) => `${name}-${id}`;

      return {
        store: (id: string, obj: T): void => {
          storage.set(toFullId(id), obj);
        },
        delete: (id: string): void => {
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
  };
};
