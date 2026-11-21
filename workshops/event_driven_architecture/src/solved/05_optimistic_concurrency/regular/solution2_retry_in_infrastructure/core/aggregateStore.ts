import {
  retryOnConflict,
  type DocumentsCollection,
  type Event,
} from '../../../tools';

export const AggregateStore = <
  A extends { dequeueUncommittedEvents(): Event[] },
>(
  collection: DocumentsCollection<A>,
) => ({
  handle: (
    id: string,
    run: (aggregate: A | null) => A | null,
  ): Promise<Event[]> =>
    retryOnConflict(async () => {
      const existing = await collection.get(id);
      const aggregate = run(existing?.document ?? null);

      if (!aggregate) return [];

      const events = aggregate.dequeueUncommittedEvents();

      if (events.length === 0) return events;

      await collection.store(id, aggregate, {
        expectedVersion: existing?.version ?? 0,
      });

      return events;
    }),
});
