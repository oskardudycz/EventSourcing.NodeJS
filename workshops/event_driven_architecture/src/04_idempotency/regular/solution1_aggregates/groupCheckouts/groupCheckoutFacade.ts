import { GroupCheckout } from '.';
import type { Database, MessageBus } from '../../../tools';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
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
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const groupCheckouts = database.collection<GroupCheckout>(
    'groupCheckout',
    GroupCheckout,
  );

  return {
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const groupCheckout = GroupCheckout.initiate(command.data);

      const events = groupCheckout.dequeueUncommittedEvents();

      await groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      await messageBus.publish(events);
    },
    recordGuestCheckoutCompletion: async (
      command: RecordGuestCheckoutCompletion,
    ) => {
      const groupCheckout = await groupCheckouts.get(
        command.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      groupCheckout.recordGuestCheckoutCompletion(command.data);

      const events = groupCheckout.dequeueUncommittedEvents();

      await groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      await messageBus.publish(events);
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = await groupCheckouts.get(
        command.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      groupCheckout.recordGuestCheckoutFailure(command.data);

      const events = groupCheckout.dequeueUncommittedEvents();

      await groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      await messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
