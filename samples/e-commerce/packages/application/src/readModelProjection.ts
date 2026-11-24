import type { CanHandle, Event, ReadEvent } from '@event-driven-io/emmett';
import { pongoSingleStreamProjection as postgreSQLPongoSingleStreamProjection } from '@event-driven-io/emmett-postgresql';
import {
  pongoSingleStreamProjection as sqlitePongoSingleStreamProjection,
  type SQLiteProjectionWithSchema,
} from '@event-driven-io/emmett-sqlite';
import type { PostgreSQLProjectionWithSchema } from '@event-driven-io/emmett-postgresql';
import type { PongoDocument } from '@event-driven-io/pongo';

export type SingleStreamReadModelOptions<
  Document extends PongoDocument,
  EventType extends Event,
> = {
  collectionName: string;
  canHandle: CanHandle<EventType>;
  getDocumentId: (event: ReadEvent<EventType>) => string;
  evolve: (
    current: Document | null,
    event: ReadEvent<EventType>,
  ) => Document | null;
};

export type ReadModel<EventType extends Event> = {
  sqlite: () => SQLiteProjectionWithSchema<EventType>;
  postgresql: () => PostgreSQLProjectionWithSchema<EventType>;
};

export const singleStreamReadModel = <
  Document extends PongoDocument,
  EventType extends Event,
>(
  options: SingleStreamReadModelOptions<Document, EventType>,
): ReadModel<EventType> => ({
  sqlite: () => sqlitePongoSingleStreamProjection<Document, EventType>(options),
  postgresql: () =>
    postgreSQLPongoSingleStreamProjection<Document, EventType>(options),
});
