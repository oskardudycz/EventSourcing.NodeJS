import {
  ExpectedVersionConflictError,
  type AppendToStreamOptions,
  type Event,
  type EventStoreSession,
} from '@event-driven-io/emmett';
import type { SQLiteEventStore } from '@event-driven-io/emmett-sqlite';

export type ConflictingEventStore = SQLiteEventStore & {
  conflictsOnTheNextAppends: (count: number) => void;
};

export const conflictingEventStore = (
  eventStore: SQLiteEventStore,
): ConflictingEventStore => {
  let conflictsLeft = 0;

  const conflictingOnAppend = (store: SQLiteEventStore): SQLiteEventStore => ({
    ...store,
    appendToStream: <
      EventType extends Event,
      EventPayloadType extends Event = EventType,
    >(
      streamName: string,
      events: EventType[],
      options?: AppendToStreamOptions<EventType, EventPayloadType>,
    ) => {
      if (conflictsLeft > 0) {
        conflictsLeft--;
        return Promise.reject(
          new ExpectedVersionConflictError(
            -1n,
            options?.expectedStreamVersion ?? 'STREAM_EXISTS',
          ),
        );
      }

      return store.appendToStream(streamName, events, options);
    },
    withSession: <T = unknown>(
      callback: (session: EventStoreSession<SQLiteEventStore>) => Promise<T>,
    ): Promise<T> =>
      store.withSession((session) =>
        callback({
          ...session,
          eventStore: conflictingOnAppend(session.eventStore),
        }),
      ),
  });

  return {
    ...conflictingOnAppend(eventStore),
    conflictsOnTheNextAppends: (count) => {
      conflictsLeft = count;
    },
  };
};
