import type { DocumentsCollection, Event } from '../../../tools';

export type Projection<Document, ProjectedEvent extends Event> = {
  canHandle: ProjectedEvent['type'][];
  handle: (event: ProjectedEvent) => Promise<Document | null>;
};

export const Projection = <Document, ProjectedEvent extends Event>(
  collection: DocumentsCollection<Document>,
  definition: {
    canHandle: ProjectedEvent['type'][];
    getDocumentId: (event: ProjectedEvent) => string | undefined;
    evolve: (
      current: Document | null,
      event: ProjectedEvent,
    ) => Document | null;
  },
): Projection<Document, ProjectedEvent> => ({
  canHandle: definition.canHandle,
  handle: async (event) => {
    const id = definition.getDocumentId(event);

    if (id === undefined) return null;

    const document = definition.evolve(await collection.get(id), event);

    if (document === null) {
      await collection.delete(id);
      return null;
    }

    await collection.store(id, document);
    return document;
  },
});
