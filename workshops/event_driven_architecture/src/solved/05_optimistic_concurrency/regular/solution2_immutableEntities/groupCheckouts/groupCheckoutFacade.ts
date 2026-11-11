import {
  retryOnConflict,
  type CommandBus,
  type Database,
  type EventBus,
} from '../../../tools';
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

export const GroupCheckoutFacade = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}) => {
  const { database, eventBus } = options;

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

          await groupCheckouts.store(
            command.data.groupCheckoutId,
            evolve(groupCheckout, event),
            { expectedVersion: 0 },
          );

          return [event];
        },
      );

      await eventBus.publish(events);
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

        await groupCheckouts.store(
          command.data.groupCheckoutId,
          events.reduce(evolve, groupCheckout),
          { expectedVersion: existing.version },
        );

        return events;
      });

      await eventBus.publish(events);
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const events = await retryOnConflict(async () => {
        const existing = await groupCheckouts.get(command.data.groupCheckoutId);

        if (!existing) {
          return [];
        }

        const groupCheckout = existing.document;

        const events = recordGuestCheckout(command, groupCheckout);

        await groupCheckouts.store(
          command.data.groupCheckoutId,
          events.reduce(evolve, groupCheckout),
          { expectedVersion: existing.version },
        );

        return events;
      });

      await eventBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
