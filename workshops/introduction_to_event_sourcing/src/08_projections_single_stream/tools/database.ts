export const getDatabase = () => {
  const storage = new Map<string, unknown>();

  return {
    collection: <T>(name: string) => {
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

          return result
            ? // Clone to simulate getting new instance on loading
              JSON.parse(JSON.stringify(result))
            : null;
        },
      };
    },
  };
};
