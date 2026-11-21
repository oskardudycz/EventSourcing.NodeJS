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
    checkInGuest: async (command: CheckInGuest) => {
      const account =
        (await accounts.get(command.data.guestStayAccountId)) ?? initial;

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    checkoutGuest: async (command: CheckoutGuest) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const event: GroupCheckoutInitiated = {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId: command.data.groupCheckoutId,
          clerkId: command.data.clerkId,
          guestStayAccountIds: command.data.guestStayIds,
          initiatedAt: command.data.now,
        },
      };
      await messageBus.publish([event]);
    },
  };
};
