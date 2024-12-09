export type StoreOptions = {
  externalVersion: number;
};

export interface DocumentsCollection<T> {
  store: (id: string, obj: T, options?: StoreOptions) => void;
  delete: (id: string) => void;
  get: (id: string) => T | null;
}

export interface Database {
  collection: <T>(name: string) => DocumentsCollection<T>;
}

export type DocumentEnvelope = {
  document: unknown;
  version: number;
};

export const getDatabase = (): Database => {
  const storage = new Map<string, DocumentEnvelope>();

  return {
    collection: <T>(name: string): DocumentsCollection<T> => {
      const toFullId = (id: string) => `${name}-${id}`;

      return {
        store: (id: string, obj: T, options?: StoreOptions): void => {
          const envelope = storage.get(toFullId(id));

          if (
            envelope &&
            options &&
            envelope.version >= options.externalVersion
          )
            return;

          storage.set(toFullId(id), {
            document: obj,
            version: options?.externalVersion ?? (envelope?.version ?? 0) + 1,
          });
        },
        delete: (id: string): void => {
          storage.delete(toFullId(id));
        },
        get: (id: string): T | null => {
          const envelope = storage.get(toFullId(id));

          if (!envelope) return null;

          // Clone to simulate getting new instance on loading
          return JSON.parse(JSON.stringify(envelope.document)) as T;
        },
      };
    },
  };
};
