import { GroupCheckout } from '.';
import type { Database, MessageBus } from '../../../tools';
import type {
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';

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
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const groupCheckouts = database.collection<GroupCheckout>(
    'groupCheckout',
    GroupCheckout,
  );

  const dequeueMessages = (groupCheckout: GroupCheckout) =>
    groupCheckout.dequeueUncommitedMessages().map(({ message }) => message);

  return {
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const groupCheckout = GroupCheckout.initiate(command);

      const messages = dequeueMessages(groupCheckout);

      await groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      await messageBus.publish(messages);
    },
    onGuestCheckedOut: async (event: GuestCheckedOut) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = await groupCheckouts.get(
        event.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      groupCheckout.onGuestCheckedOut(event);

      const messages = dequeueMessages(groupCheckout);

      await groupCheckouts.store(event.data.groupCheckoutId, groupCheckout);

      await messageBus.publish(messages);
    },
    onGuestCheckoutFailed: async (event: GuestCheckoutFailed) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = await groupCheckouts.get(
        event.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      groupCheckout.onGuestCheckoutFailed(event);

      const messages = dequeueMessages(groupCheckout);

      await groupCheckouts.store(event.data.groupCheckoutId, groupCheckout);

      await messageBus.publish(messages);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
