import { v4 as uuid } from 'uuid';
import type { Database } from './database';
import type { Event, MessageBus } from './messageBus';
import { retryUntilSucceeds } from './retry';
import { TimeoutError } from './timeoutError';

export const publishOrStoreInOutbox = async (
  {
    database,
    messageBus,
    outboxName,
  }: { database: Database; messageBus: MessageBus; outboxName: string },
  events: Event[],
): Promise<void> => {
  for (const [index, event] of events.entries()) {
    try {
      await messageBus.publish([event]);
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
  messageBus,
  outboxName,
}: {
  database: Database;
  messageBus: MessageBus;
  outboxName: string;
}): Promise<void> => {
  const outbox = database.collection<Event>(outboxName);

  for (const { id, document: event } of await outbox.getAll()) {
    await messageBus.publish([event]);

    await retryUntilSucceeds(() => outbox.delete(id));
  }
};
