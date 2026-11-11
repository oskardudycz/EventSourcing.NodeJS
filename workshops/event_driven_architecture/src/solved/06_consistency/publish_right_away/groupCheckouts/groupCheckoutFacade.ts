import {
  publishFromOutbox,
  publishOrStoreInOutbox,
  retryOnConflict,
  retryUntilSucceeds,
  type BackgroundJobs,
  type Database,
  type MessageBus,
} from '../tools';
import {
  initiateGroupCheckout,
  recordGuestCheckout,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from './businessLogic';
import {
  evolve,
  initial,
  type GroupCheckout,
  type GroupCheckoutEvent,
} from './groupCheckout';

const outboxName = 'groupCheckoutsOutbox';

export const GroupCheckoutFacade = (options: {
  database: Database;
  messageBus: MessageBus;
  backgroundJobs: BackgroundJobs;
}) => {
  const { database, messageBus, backgroundJobs } = options;

  backgroundJobs.register(() =>
    publishFromOutbox({ database, messageBus, outboxName }),
  );

  const groupCheckouts = database.collection<GroupCheckout>('groupCheckout');

  return {
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const events = await retryOnConflict(
        async (): Promise<GroupCheckoutEvent[]> => {
          const existing = await groupCheckouts.get(
            command.data.groupCheckoutId,
          );

          if (existing) return [];

          const groupCheckout = initial;

          const event = initiateGroupCheckout(command, groupCheckout);

          await retryUntilSucceeds(() =>
            groupCheckouts.store(
              command.data.groupCheckoutId,
              evolve(groupCheckout, event),
              { expectedVersion: 0 },
            ),
          );

          return [event];
        },
      );

      await publishOrStoreInOutbox(
        { database, messageBus, outboxName },
        events,
      );
    },
    recordGuestCheckoutCompletion: async (
      command: RecordGuestCheckoutCompletion,
    ) => {
      const events = await retryOnConflict(async () => {
        const existing = await groupCheckouts.get(command.data.groupCheckoutId);

        if (!existing) {
          return [];
        }

        const groupCheckout = existing.document;

        const events = recordGuestCheckout(command, groupCheckout);

        await retryUntilSucceeds(() =>
          groupCheckouts.store(
            command.data.groupCheckoutId,
            events.reduce(evolve, groupCheckout),
            { expectedVersion: existing.version },
          ),
        );

        return events;
      });

      await publishOrStoreInOutbox(
        { database, messageBus, outboxName },
        events,
      );
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const events = await retryOnConflict(async () => {
        const existing = await groupCheckouts.get(command.data.groupCheckoutId);

        if (!existing) {
          return [];
        }

        const groupCheckout = existing.document;

        const events = recordGuestCheckout(command, groupCheckout);

        await retryUntilSucceeds(() =>
          groupCheckouts.store(
            command.data.groupCheckoutId,
            events.reduce(evolve, groupCheckout),
            { expectedVersion: existing.version },
          ),
        );

        return events;
      });

      await publishOrStoreInOutbox(
        { database, messageBus, outboxName },
        events,
      );
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
