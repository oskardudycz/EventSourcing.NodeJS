import {
  publishFromOutbox,
  retryOnConflict,
  retryUntilSucceeds,
  storeInOutbox,
  type BackgroundJobs,
  type CommandBus,
  type Database,
  type EventBus,
} from '../tools';
import {
  initiateGroupCheckout,
  recordGuestCheckout,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from './businessLogic';
import { evolve, initial, type GroupCheckout } from './groupCheckout';

const outboxName = 'groupCheckoutsOutbox';

export const GroupCheckoutFacade = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
  backgroundJobs: BackgroundJobs;
}) => {
  const { database, eventBus, backgroundJobs } = options;

  backgroundJobs.register(() =>
    publishFromOutbox({ database, eventBus, outboxName }),
  );

  const groupCheckouts = (database: Database) =>
    database.collection<GroupCheckout>('groupCheckout');

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) =>
      retryOnConflict(() =>
        retryUntilSucceeds(() =>
          database.transaction(async (transaction) => {
            const existing = await groupCheckouts(transaction).get(
              command.data.groupCheckoutId,
            );

            if (existing) return;

            const groupCheckout = initial;

            const event = initiateGroupCheckout(command, groupCheckout);

            await groupCheckouts(transaction).store(
              command.data.groupCheckoutId,
              evolve(groupCheckout, event),
              { expectedVersion: 0 },
            );

            await storeInOutbox(transaction, outboxName, [event]);
          }),
        ),
      ),
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) =>
      retryOnConflict(() =>
        retryUntilSucceeds(() =>
          database.transaction(async (transaction) => {
            const existing = await groupCheckouts(transaction).get(
              command.data.groupCheckoutId,
            );

            if (!existing) {
              return;
            }

            const groupCheckout = existing.document;

            const events = recordGuestCheckout(command, groupCheckout);

            await groupCheckouts(transaction).store(
              command.data.groupCheckoutId,
              events.reduce(evolve, groupCheckout),
              { expectedVersion: existing.version },
            );

            await storeInOutbox(transaction, outboxName, events);
          }),
        ),
      ),
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) =>
      retryOnConflict(() =>
        retryUntilSucceeds(() =>
          database.transaction(async (transaction) => {
            const existing = await groupCheckouts(transaction).get(
              command.data.groupCheckoutId,
            );

            if (!existing) {
              return;
            }

            const groupCheckout = existing.document;

            const events = recordGuestCheckout(command, groupCheckout);

            await groupCheckouts(transaction).store(
              command.data.groupCheckoutId,
              events.reduce(evolve, groupCheckout),
              { expectedVersion: existing.version },
            );

            await storeInOutbox(transaction, outboxName, events);
          }),
        ),
      ),
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
