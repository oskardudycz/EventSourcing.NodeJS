import { v4 as uuid } from 'uuid';
import type { Database } from './database';
import type { Event, EventBus } from './eventBus';
import { retryUntilSucceeds } from './retry';
import { TimeoutError } from './timeoutError';

export const publishOrStoreInOutbox = async (
  {
    database,
    eventBus,
    outboxName,
  }: { database: Database; eventBus: EventBus; outboxName: string },
  events: Event[],
): Promise<void> => {
  for (const [index, event] of events.entries()) {
    try {
      await eventBus.publish([event]);
    } catch (error) {
      if (!(error instanceof TimeoutError)) throw error;

      await retryUntilSucceeds(() =>
        database.transaction(async (transaction) => {
          const outbox = transaction.collection<Event>(outboxName);

          for (const notPublished of events.slice(index))
            await outbox.store(uuid(), notPublished);
        }),
      );
      return;
    }
  }
};

export const publishFromOutbox = async ({
  database,
  eventBus,
  outboxName,
}: {
  database: Database;
  eventBus: EventBus;
  outboxName: string;
}): Promise<void> => {
  const outbox = database.collection<Event>(outboxName);

  for (const { id, document: event } of await outbox.getAll()) {
    await eventBus.publish([event]);

    await retryUntilSucceeds(() => outbox.delete(id));
  }
};
