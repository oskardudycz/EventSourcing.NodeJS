import { v4 as uuid } from 'uuid';

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export type EventMetadata = Readonly<{
  eventId: string;
  streamPosition: bigint;
  logPosition: bigint;
}>;

export type EventEnvelope<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Event<EventType, EventData> & { metadata: EventMetadata };

export interface EventStore {
  readStream<E extends Event>(streamId: string): E[];
  appendToStream(streamId: string, events: Event[]): void;
}

export type EventHandler<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = (eventEnvelope: EventEnvelope<EventType, EventData>) => void;

export const getEventStore = () => {
  const streams = new Map<string, EventEnvelope[]>();
  const handlers = new Map<string, EventHandler>();

  const getAllEventsCount = () => {
    let count = 0;
    for (const stream in streams.values) {
      count += stream.length;
    }
    return count;
  };

  return {
    readStream: <E extends Event>(streamId: string): E[] => {
      return streams.get(streamId)?.map((e) => <E>e) ?? [];
    },
    appendToStream: <E extends Event>(
      streamId: string,
      ...events: E[]
    ): void => {
      const current = streams.get(streamId) ?? [];

      const eventEnvelopes: EventEnvelope[] = events.map((event, index) => {
        return {
          ...event,
          metadata: {
            eventId: uuid(),
            streamPosition: BigInt(current.length + index + 1),
            logPosition: BigInt(getAllEventsCount() + index + 1),
          },
        };
      });

      streams.set(streamId, [...current, ...eventEnvelopes]);

      for (const eventEnvelope of eventEnvelopes) {
        const handler = handlers.get(eventEnvelope.type);

        if (!handler) continue;

        handler(eventEnvelope);
      }
    },
    subscribe: <
      EventType extends string = string,
      EventData extends Record<string, unknown> = Record<string, unknown>
    >(
      eventType: string,
      eventHandler: EventHandler<EventType, EventData>
    ) => {
      handlers.set(eventType, (eventEnvelope) =>
        eventHandler(
          eventEnvelope as unknown as EventEnvelope<EventType, EventData>
        )
      );
    },
  };
};
