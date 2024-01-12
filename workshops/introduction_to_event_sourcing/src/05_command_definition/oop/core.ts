export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export interface EventStore {
  readStream<E extends Event>(streamId: string): E[];
  appendToStream(streamId: string, events: Event[]): void;
}

export const getEventStore = () => {
  const streams = new Map<string, Event[]>();

  return {
    readStream: <E extends Event>(streamId: string): E[] => {
      return streams.get(streamId)?.map((e) => <E>e) ?? [];
    },
    appendToStream: (streamId: string, events: Event[]): void => {
      const current = streams.get(streamId) ?? [];

      streams.set(streamId, [...current, ...events]);
    },
  };
};
