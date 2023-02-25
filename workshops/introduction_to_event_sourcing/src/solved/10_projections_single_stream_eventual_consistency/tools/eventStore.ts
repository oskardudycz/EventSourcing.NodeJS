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
  streamPosition: number;
  logPosition: bigint;
}>;

export type EventEnvelope<E extends Event = Event> = E & {
  metadata: EventMetadata;
};

export interface EventStore {
  readStream<E extends Event>(streamId: string): E[];
  appendToStream(streamId: string, events: Event[]): Promise<void>;
}

export type EventHandler<E extends Event = Event> = (
  eventEnvelope: EventEnvelope<E>
) => Promise<void>;

export const getEventStore = () => {
  const streams = new Map<string, EventEnvelope[]>();
  const handlers: EventHandler[] = [];

  const getAllEventsCount = () => {
    return Array.from<EventEnvelope[]>(streams.values())
      .map((s) => s.length)
      .reduce((p, c) => p + c, 0);
  };

  return {
    readStream: <E extends Event>(streamId: string): E[] => {
      return streams.get(streamId)?.map((e) => <E>e) ?? [];
    },
    appendToStream: async <E extends Event>(
      streamId: string,
      ...events: E[]
    ): Promise<void> => {
      const current = streams.get(streamId) ?? [];

      const eventEnvelopes: EventEnvelope[] = events.map((event, index) => {
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
          let numberOfRepeatedPublish = Math.round(Math.random() * 5);

          do {
            await handler(eventEnvelope);
          } while (--numberOfRepeatedPublish > 0);
        }
      }
    },
    subscribe: <E extends Event>(eventHandler: EventHandler<E>): void => {
      handlers.push((eventEnvelope) =>
        eventHandler(eventEnvelope as EventEnvelope<E>)
      );
    },
  };
};
