export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export interface EventStore {
  readStream<E extends Event>(streamId: string): E[];
  appendToStream(streamId: string, ...events: Event[]): void;
}

export const getEventStore = () => {
  const streams = new Map<string, Event[]>();

  return {
    readStream: <E extends Event>(streamId: string): E[] => {
      return streams.get(streamId)?.map((e) => <E>e) ?? [];
    },
    appendToStream: (streamId: string, ...events: Event[]): void => {
      const current = streams.get(streamId) ?? [];

      streams.set(streamId, [...current, ...events]);
    },
  };
};

export const merge = <T>(
  array: T[],
  item: T,
  where: (current: T) => boolean,
  onExisting: (current: T) => T,
  onNotFound: () => T | undefined = () => undefined,
) => {
  let wasFound = false;

  const result = array
    // merge the existing item if matches condition
    .map((p: T) => {
      if (!where(p)) return p;

      wasFound = true;
      return onExisting(p);
    })
    // filter out item if undefined was returned
    // for cases of removal
    .filter((p) => p !== undefined)
    // make TypeScript happy
    .map((p) => {
      if (!p) throw Error('That should not happen');

      return p;
    });

  // if item was not found and onNotFound action is defined
  // try to generate new item
  if (!wasFound) {
    const result = onNotFound();

    if (result !== undefined) return [...array, item];
  }

  return result;
};
