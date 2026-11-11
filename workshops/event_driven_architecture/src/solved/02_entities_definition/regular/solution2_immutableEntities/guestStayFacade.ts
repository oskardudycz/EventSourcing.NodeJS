import type { Database, MessageBus } from '../../tools';
import type { GroupCheckoutInitiated } from './groupCheckouts';
import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type GuestStayAccount,
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

export const GuestStayFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: (command: CheckInGuest) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      messageBus.publish(events);
    },
    recordCharge: (command: RecordCharge) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      messageBus.publish(events);
    },
    recordPayment: (command: RecordPayment) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      messageBus.publish(events);
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      messageBus.publish(events);
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
      messageBus.publish([event]);
    },
  };
};
