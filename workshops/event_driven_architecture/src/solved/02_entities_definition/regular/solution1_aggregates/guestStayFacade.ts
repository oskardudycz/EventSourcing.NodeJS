import type { Database, MessageBus } from '../../tools';
import type { GroupCheckoutInitiated } from './groupCheckouts';
import { GuestStayAccount } from './guestStayAccounts';

export type CheckInGuest = {
  type: 'CheckInGuest';
  data: {
    guestStayAccountId: string;
    now: Date;
  };
};
export type RecordCharge = {
  type: 'RecordCharge';
  data: {
    guestStayAccountId: string;
    amount: number;
    now: Date;
  };
};

export type RecordPayment = {
  type: 'RecordPayment';
  data: {
    guestStayAccountId: string;
    amount: number;
    now: Date;
  };
};

export type CheckOutGuest = {
  type: 'CheckOutGuest';
  data: {
    guestStayAccountId: string;
    now: Date;
    groupCheckoutId?: string | undefined;
  };
};

export type GuestStayAccountCommand =
  CheckInGuest | RecordCharge | RecordPayment | CheckOutGuest;

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

export const GuestStayFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>(
    'guestStayAccount',
    GuestStayAccount,
  );

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const account = GuestStayAccount.checkIn(command.data);

      const events = account.dequeueUncommittedEvents();

      await accounts.store(command.data.guestStayAccountId, account);

      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      account.recordCharge(command.data);

      const events = account.dequeueUncommittedEvents();

      await accounts.store(command.data.guestStayAccountId, account);

      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      account.recordPayment(command.data);

      const events = account.dequeueUncommittedEvents();

      await accounts.store(command.data.guestStayAccountId, account);

      await messageBus.publish(events);
    },
    checkOutGuest: async (command: CheckOutGuest) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      account.checkout(command.data);

      const events = account.dequeueUncommittedEvents();

      await accounts.store(command.data.guestStayAccountId, account);

      await messageBus.publish(events);
    },
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const event: GroupCheckoutInitiated = {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId: command.data.groupCheckoutId,
          clerkId: command.data.clerkId,
          guestStayAccountIds: command.data.guestStayAccountIds,
          initiatedAt: command.data.now,
        },
      };
      await messageBus.publish([event]);
    },
  };
};
