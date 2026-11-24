import {
  ExpectedVersionConflictError,
  type AppendToStreamOptions,
  type Event,
  type EventStoreSession,
} from '@event-driven-io/emmett';
import type { ModuleStore } from './eventStore';

export type ConflictingEventStore = ModuleStore & {
  conflictsOnTheNextAppends: (count: number) => void;
};

export const conflictingEventStore = (
  eventStore: ModuleStore,
): ConflictingEventStore => {
  let conflictsLeft = 0;

  const conflictingOnAppend = (store: ModuleStore): ModuleStore => ({
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
      callback: (session: EventStoreSession<ModuleStore>) => Promise<T>,
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
