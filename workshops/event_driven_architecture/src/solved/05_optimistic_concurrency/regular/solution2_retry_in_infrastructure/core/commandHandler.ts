import {
  retryOnConflict,
  type DocumentsCollection,
  type Event,
} from '../../../tools';

export const CommandHandler = <State, E extends Event>(options: {
  collection: DocumentsCollection<State>;
  evolve: (state: State, event: E) => State;
  initial: State;
}) => {
  const { collection, evolve, initial } = options;

  return {
    handle: (id: string, decide: (state: State) => E[]): Promise<E[]> =>
      retryOnConflict(async () => {
        const existing = await collection.get(id);
        const state = existing?.document ?? initial;

        const events = decide(state);

        if (events.length === 0) return events;

        await collection.store(id, events.reduce(evolve, state), {
          expectedVersion: existing?.version ?? 0,
        });

        return events;
      }),
  };
};
