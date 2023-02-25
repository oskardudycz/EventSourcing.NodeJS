export type StoreOptions = {
  externalVersion: number;
};

export interface DocumentsCollection<T> {
  store: (id: string, obj: T, options?: StoreOptions) => boolean;
  delete: (id: string) => boolean;
  get: (id: string) => T | null;
}

export interface Database {
  collection: <T>(name: string) => DocumentsCollection<T>;
}

export type DocumentEnvelope = {
  document: unknown;
  version: number;
  validFrom: Date;
};

export const getDatabase = (): Database => {
  const storage = new Map<string, DocumentEnvelope[]>();

  return {
    collection: <T>(name: string): DocumentsCollection<T> => {
      const toFullId = (id: string) => `${name}-${id}`;

      const getDocumentVersions = (id: string) => {
        const documentVersions = storage.get(toFullId(id));

        if (!documentVersions) return null;

        return documentVersions;
      };

      const getValidVersions = (id: string, from: Date) => {
        const documentVersions = getDocumentVersions(id);

        if (!documentVersions) return null;

        return documentVersions.filter((d) => d.validFrom <= from);
      };

      const isDocumentTransitioning = (id: string, from: Date) => {
        return (
          (getDocumentVersions(id)?.length ?? 0) !=
          (getValidVersions(id, from)?.length ?? 0)
        );
      };

      const getMostRecentValidDocumentVersion = (id: string) => {
        const now = new Date();

        const validVersions = getValidVersions(id, now);

        if (!validVersions || validVersions.length === 0) return null;

        return validVersions[validVersions.length - 1];
        // Clone to simulate getting new instance on loading
      };

      return {
        store: (id: string, obj: T, options?: StoreOptions): boolean => {
          const now = new Date();

          if (isDocumentTransitioning(id, now)) return false;

          const envelope = getMostRecentValidDocumentVersion(id);

          if (
            envelope &&
            options &&
            envelope.version >= options.externalVersion
          )
            return true;

          const validFrom = envelope?.validFrom ?? new Date();
          const delay = Math.round(Math.random() * 50) + 50;
          validFrom.setMilliseconds(validFrom.getMilliseconds() + delay);

          storage.set(toFullId(id), [
            ...(getDocumentVersions(id) ?? []),
            {
              document: obj,
              validFrom,
              version: options?.externalVersion ?? (envelope?.version ?? 0) + 1,
            },
          ]);

          return true;
        },
        delete: (id: string): boolean => {
          const now = new Date();

          if (isDocumentTransitioning(id, now)) return false;

          storage.delete(toFullId(id));

          return true;
        },
        get: (id: string): T | null => {
          const envelope = getMostRecentValidDocumentVersion(id);

          if (!envelope) return null;

          return JSON.parse(JSON.stringify(envelope?.document)) as T;
        },
      };
    },
  };
};
