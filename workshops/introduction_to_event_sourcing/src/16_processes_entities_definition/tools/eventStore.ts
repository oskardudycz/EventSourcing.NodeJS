import { v4 as uuid } from 'uuid';

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export type EventMetadata = Readonly<{
  eventId: string;
  streamPosition: number;
  logPosition: bigint;
}>;

export type RecordedEvent<E extends Event = Event> = E & {
  metadata: EventMetadata;
};

export type AggregateStreamOptions<Entity, E extends Event> = {
  evolve: (currentState: Entity, event: E) => Entity;
  initial: () => Entity;
};

export interface EventStore {
  readStream<E extends Event>(streamId: string): E[];
  aggregateStream<Entity, E extends Event>(
    streamId: string,
    options: AggregateStreamOptions<Entity, E>,
  ): Entity;
  appendToStream(streamId: string, events: Event[]): void;
  use(middleware: DomainEventHandler): void;
}

export type EventHandler<E extends Event = Event> = (
  eventEnvelope: RecordedEvent<E>,
) => void;

export type DomainEventHandler<E extends Event = Event> = (event: E) => void;

export const getEventStore = () => {
  const streams = new Map<string, RecordedEvent[]>();
  const handlers: EventHandler[] = [];
  const middlewares: DomainEventHandler[] = [];

  const getAllEventsCount = () => {
    return Array.from<RecordedEvent[]>(streams.values())
      .map((s) => s.length)
      .reduce((p, c) => p + c, 0);
  };

  return {
    readStream: <E extends Event>(streamId: string): E[] => {
      return streams.get(streamId)?.map((e) => <E>e) ?? [];
    },

    aggregateStream: <Entity, E extends Event>(
      streamId: string,
      options: {
        evolve: (currentState: Entity, event: E) => Entity;
        initial: () => Entity;
      },
    ): Entity => {
      const events = streams.get(streamId)?.map((e) => <E>e) ?? [];

      return events.reduce(options.evolve, options.initial());
    },
    appendToStream: <E extends Event>(streamId: string, events: E[]): void => {
      const current = streams.get(streamId) ?? [];

      for (const event of events)
        for (const middleware of middlewares) middleware(event as Event);

      const eventEnvelopes: RecordedEvent[] = events.map((event, index) => {
        return {
          ...event,
          metadata: {
            eventId: uuid(),
            streamPosition: current.length + index + 1,
            logPosition: BigInt(getAllEventsCount() + index + 1),
          },
        };
      });

      streams.set(streamId, [...current, ...eventEnvelopes]);

      for (const eventEnvelope of eventEnvelopes) {
        for (const handler of handlers) {
          handler(eventEnvelope);
        }
      }
    },
    subscribe: <E extends Event>(eventHandler: EventHandler<E>): void => {
      handlers.push((eventEnvelope) =>
        eventHandler(eventEnvelope as RecordedEvent<E>),
      );
    },
    use: (middleware: DomainEventHandler): void => {
      middlewares.push(middleware);
    },
  };
};
