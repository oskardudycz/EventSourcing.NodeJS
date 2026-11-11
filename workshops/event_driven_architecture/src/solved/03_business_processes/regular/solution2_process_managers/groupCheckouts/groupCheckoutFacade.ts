import { GroupCheckout } from '.';
import type { Database, MessageBus } from '../../../tools';
import {
  type GuestCheckedOut,
  type GuestCheckoutFailed,
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

  const groupCheckouts = database.collection<GroupCheckout>('groupCheckout');

  const publishMessages = (groupCheckout: GroupCheckout) => {
    const messages = groupCheckout.dequeueUncommitedMessages();

    messageBus.publish(messages.map(({ message }) => message));
  };

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const groupCheckout = GroupCheckout.initiate(command);

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      publishMessages(groupCheckout);
    },
    onGuestCheckedOut: (event: GuestCheckedOut) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = groupCheckouts.get(event.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      groupCheckout.onGuestCheckedOut(event);

      groupCheckouts.store(event.data.groupCheckoutId, groupCheckout);

      publishMessages(groupCheckout);
    },
    onGuestCheckoutFailed: (event: GuestCheckoutFailed) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = groupCheckouts.get(event.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      groupCheckout.onGuestCheckoutFailed(event);

      groupCheckouts.store(event.data.groupCheckoutId, groupCheckout);

      publishMessages(groupCheckout);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
