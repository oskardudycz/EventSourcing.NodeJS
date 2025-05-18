import type { Database, EventBus } from '../../tools';
import type { GroupCheckoutInitiated } from './groupCheckouts';
import { GuestStayAccount } from './guestStayAccounts';

export type CheckInGuest = {
  type: 'CheckInGuest';
  data: {
    guestStayAccountId: string;
    guestId: string;
    roomId: string;
    now: Date;
  };
};
export type RecordCharge = {
  type: 'RecordCharge';
  data: {
    guestStayAccountId: string;
    chargeId: string;
    amount: number;
    now: Date;
  };
};

export type RecordPayment = {
  type: 'RecordPayment';
  data: {
    guestStayAccountId: string;
    paymentId: string;
    amount: number;
    now: Date;
  };
};

export type CheckoutGuest = {
  type: 'CheckoutGuest';
  data: {
    guestStayAccountId: string;
    now: Date;
    groupCheckoutId?: string | undefined;
  };
};

export type GuestStayAccountCommand =
  | CheckInGuest
  | RecordCharge
  | RecordPayment
  | CheckoutGuest;

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
  eventBus: EventBus;
}) => {
  const { database, eventBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: (command: CheckInGuest) => {
      if (accounts.get(command.data.guestStayAccountId)) {
        throw Error('Guest is already checked-in!');
      }

      const account = GuestStayAccount.checkInGuest(command.data);

      accounts.store(command.data.guestStayAccountId, account);
      eventBus.publish(account.dequeueUncommitedEvents());
    },
    recordCharge: (command: RecordCharge) => {
      const account = accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      account.recordCharge(command.data);

      accounts.store(command.data.guestStayAccountId, account);
      eventBus.publish(account.dequeueUncommitedEvents());
    },
    recordPayment: (command: RecordPayment) => {
      const account = accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      account.recordPayment(command.data);

      accounts.store(command.data.guestStayAccountId, account);
      eventBus.publish(account.dequeueUncommitedEvents());
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      account.checkoutGuest(command.data);

      accounts.store(command.data.guestStayAccountId, account);
      eventBus.publish(account.dequeueUncommitedEvents());
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
      eventBus.publish([event]);
    },
  };
};
