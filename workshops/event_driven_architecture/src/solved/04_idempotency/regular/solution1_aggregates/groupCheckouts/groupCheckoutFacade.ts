import { GroupCheckout } from '.';
import type { Database, MessageBus } from '../../../tools';

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

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      if (groupCheckouts.get(command.data.groupCheckoutId)) return;

      const groupCheckout = GroupCheckout.initiate(command.data);

      const events = groupCheckout.dequeueUncommitedEvents();

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      messageBus.publish(events);
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      groupCheckout.recordGuestCheckoutCompletion(command.data);

      const events = groupCheckout.dequeueUncommitedEvents();

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      messageBus.publish(events);
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      groupCheckout.recordGuestCheckoutFailure(command.data);

      const events = groupCheckout.dequeueUncommitedEvents();

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);

      messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
