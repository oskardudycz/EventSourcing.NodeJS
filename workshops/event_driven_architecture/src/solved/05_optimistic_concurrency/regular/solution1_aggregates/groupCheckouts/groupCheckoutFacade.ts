import { GroupCheckout } from '.';
import {
  retryOnConflict,
  type CommandBus,
  type Database,
  type EventBus,
} from '../../../tools';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayIds: string[];
    now: Date;
  };
};

export type RecordGuestCheckoutCompletion = {
  type: 'RecordGuestCheckoutCompletion';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    now: Date;
  };
};

export type RecordGuestCheckoutFailure = {
  type: 'RecordGuestCheckoutFailure';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    now: Date;
  };
};

export type GroupCheckoutCommand =
  | InitiateGroupCheckout
  | RecordGuestCheckoutCompletion
  | RecordGuestCheckoutFailure;

export const GroupCheckoutFacade = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}) => {
  const { database, eventBus } = options;

  const groupCheckouts = database.collection<GroupCheckout>('groupCheckout');

  return {
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const events = await retryOnConflict(async () => {
        if (await groupCheckouts.get(command.data.groupCheckoutId)) return [];

        const groupCheckout = GroupCheckout.initiate(command.data);

        const events = groupCheckout.dequeueUncommitedEvents();

        await groupCheckouts.store(
          command.data.groupCheckoutId,
          groupCheckout,
          {
            expectedVersion: 0,
          },
        );

        return events;
      });

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

        groupCheckout.recordGuestCheckoutCompletion(command.data);

        const events = groupCheckout.dequeueUncommitedEvents();

        await groupCheckouts.store(
          command.data.groupCheckoutId,
          groupCheckout,
          {
            expectedVersion: existing.version,
          },
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

        groupCheckout.recordGuestCheckoutFailure(command.data);

        const events = groupCheckout.dequeueUncommitedEvents();

        await groupCheckouts.store(
          command.data.groupCheckoutId,
          groupCheckout,
          {
            expectedVersion: existing.version,
          },
        );

        return events;
      });

      await eventBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
