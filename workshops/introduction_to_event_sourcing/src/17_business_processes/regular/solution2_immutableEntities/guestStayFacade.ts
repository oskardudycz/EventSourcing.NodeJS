import type { EventStore } from '../../tools';
import type { GroupCheckoutInitiated } from './groupCheckouts';
import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type RecordCharge,
  type RecordPayment,
} from './guestStayAccounts';

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

export const GuestStayFacade = (options: { eventStore: EventStore }) => {
  const { eventStore } = options;

  const aggregateOptions = { evolve, initial: () => initial };

  return {
    checkInGuest: (command: CheckInGuest) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    recordCharge: (command: RecordCharge) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    recordPayment: (command: RecordPayment) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const event: GroupCheckoutInitiated = {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId: command.data.groupCheckoutId,
          clerkId: command.data.clerkId,
          guestStayAccountIds: command.data.guestStayIds,
          initiatedAt: command.data.now,
        },
      };
      eventStore.appendToStream(command.data.groupCheckoutId, [event]);
    },
  };
};
