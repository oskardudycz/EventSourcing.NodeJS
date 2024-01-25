import {
  ANY,
  AppendExpectedRevision,
  EventData,
  EventStoreDBClient,
  EventType,
  EventTypeToRecordedEvent,
  StreamNotFoundError,
  jsonEvent,
} from '@eventstore/db-client';
import { Event } from './event';

export interface EventStore {
  aggregateStream<Entity, E extends Event, Payload extends Event = E>(
    streamName: string,
    options: {
      evolve: (currentState: Entity, event: E) => Entity;
      getInitialState: () => Entity;
      parse?: (recordedEvent: EventTypeToRecordedEvent<Payload>) => E | null;
    },
  ): Promise<Entity | null>;

  readStream<E extends Event, Payload extends Event = E>(
    streamName: string,
    options?: {
      parse?: (recordedEvent: EventTypeToRecordedEvent<Payload>) => E | null;
    },
  ): Promise<E[]>;

  appendToStream<E extends Event>(
    streamId: string,
    events: E[],
    options?: {
      expectedRevision?: AppendExpectedRevision;
      serialize?: (resolvedEvent: Event) => EventType;
    },
  ): Promise<bigint>;
}

export const getEventStore = (eventStore: EventStoreDBClient): EventStore => {
  return {
    aggregateStream: async <Entity, E extends Event, Payload extends Event = E>(
      streamName: string,
      options: {
        evolve: (currentState: Entity, event: E) => Entity;
        getInitialState: () => Entity;
        parse?: (recordedEvent: EventTypeToRecordedEvent<Payload>) => E | null;
      },
    ): Promise<Entity | null> => {
      try {
        const { evolve, getInitialState, parse } = options;

        let state = getInitialState();

        for await (const { event } of eventStore.readStream<Payload>(
          streamName,
        )) {
          if (!event) continue;

          const parsedEvent =
            (parse ? parse(event) : null) ??
            <E>{
              type: event.type,
              data: event.data,
            };

          state = evolve(state, parsedEvent);
        }
        return state;
      } catch (error) {
        if (error instanceof StreamNotFoundError) {
          return null;
        }

        throw error;
      }
    },
    readStream: async <E extends Event, Payload extends Event = E>(
      streamName: string,
      options?: {
        parse?: (recordedEvent: EventTypeToRecordedEvent<Payload>) => E | null;
      },
    ): Promise<E[]> => {
      const parse = options?.parse;

      const events: E[] = [];

      try {
        for await (const { event } of eventStore.readStream<Payload>(
          streamName,
        )) {
          if (!event) continue;

          const parsedEvent =
            (parse ? parse(event) : null) ??
            <E>{
              type: event.type,
              data: event.data,
            };

          events.push(parsedEvent);
        }
        return events;
      } catch (error) {
        if (error instanceof StreamNotFoundError) {
          return [];
        }

        throw error;
      }
    },
    appendToStream: async <E extends Event>(
      streamId: string,
      events: E[],
      options?: {
        expectedRevision?: AppendExpectedRevision;
        serialize?: (resolvedEvent: Event) => EventData;
      },
    ): Promise<bigint> => {
      const serializedEvents = events.map((e) => {
        return options?.serialize ? options?.serialize(e) : jsonEvent(e);
      });

      const appendResult = await eventStore.appendToStream(
        streamId,
        serializedEvents,
        {
          expectedRevision: options?.expectedRevision ?? ANY,
        },
      );

      return appendResult.nextExpectedRevision;
    },
  };
};
