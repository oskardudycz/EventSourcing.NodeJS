import { v4 as uuid } from 'uuid';
import type { Database } from './database';
import type { Event, EventBus } from './eventBus';
import { retryUntilSucceeds } from './retry';

type Checkpoint = { position: number };

export const storeInOutbox = async (
  transaction: Database,
  outboxName: string,
  events: Event[],
): Promise<void> => {
  const outbox = transaction.collection<Event>(outboxName);

  for (const event of events) await outbox.store(uuid(), event);
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
  const checkpoints = database.collection<Checkpoint>('outboxCheckpoints');

  const checkpoint =
    (await checkpoints.get(outboxName))?.document.position ?? 0;

  const messages = (await outbox.getAll()).filter(
    ({ position }) => position > checkpoint,
  );

  for (const { document: event, position } of messages) {
    await eventBus.publish([event]);

    await retryUntilSucceeds(() => checkpoints.store(outboxName, { position }));
  }
};
