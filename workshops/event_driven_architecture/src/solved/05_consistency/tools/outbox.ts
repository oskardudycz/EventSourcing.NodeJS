import { v4 as uuid } from 'uuid';
import type { Database } from './database';
import type { Event, EventBus } from './eventBus';
import { retryUntilSucceeds } from './retry';

export type OutboxMessage = {
  id: string;
  message: Event;
};

export const storeAndPublish = (
  { database, eventBus }: { database: Database; eventBus: EventBus },
  events: Event[],
  storeState: (transaction: Database) => void,
): void => {
  const outboxMessages: OutboxMessage[] = events.map((message) => ({
    id: uuid(),
    message,
  }));

  retryUntilSucceeds(() =>
    database.transaction((transaction) => {
      storeState(transaction);

      const outbox = transaction.collection<OutboxMessage>('outbox');
      for (const outboxMessage of outboxMessages)
        outbox.store(outboxMessage.id, outboxMessage);
    }),
  );

  const outbox = database.collection<OutboxMessage>('outbox');
  for (const outboxMessage of outboxMessages) {
    retryUntilSucceeds(() => eventBus.publish([outboxMessage.message]));
    retryUntilSucceeds(() => outbox.delete(outboxMessage.id));
  }
};
