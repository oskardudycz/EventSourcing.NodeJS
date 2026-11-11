import {
  publishFromOutbox,
  publishOrStoreInOutbox,
  retryOnConflict,
  retryUntilSucceeds,
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
import {
  evolve,
  initial,
  type GroupCheckout,
  type GroupCheckoutEvent,
} from './groupCheckout';

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

      await publishOrStoreInOutbox({ database, eventBus, outboxName }, events);
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

      await publishOrStoreInOutbox({ database, eventBus, outboxName }, events);
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

      await publishOrStoreInOutbox({ database, eventBus, outboxName }, events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
