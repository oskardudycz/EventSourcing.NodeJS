import { GroupCheckout } from '.';
import type { CommandBus, Database, EventBus } from '../../../tools';
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
  eventBus: EventBus;
  commandBus: CommandBus;
}) => {
  const { database, eventBus, commandBus } = options;

  const groupCheckouts = database.collection<GroupCheckout>('groupCheckout');

  const publishMessages = (groupCheckout: GroupCheckout) => {
    const messages = groupCheckout.dequeueUncommitedMessages();

    for (const { kind, message } of messages) {
      if (kind === 'Event') eventBus.publish([message]);
      else commandBus.send([message]);
    }
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
