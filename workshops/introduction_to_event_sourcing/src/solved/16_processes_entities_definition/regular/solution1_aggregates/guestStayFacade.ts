import type { EventStore } from '../../tools';
import type { GroupCheckoutInitiated } from './groupCheckouts';
import {
  GuestStayAccount,
  type GuestStayAccountEvent,
} from './guestStayAccounts';

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

export const GuestStayFacade = (options: { eventStore: EventStore }) => {
  const { eventStore: eventStore } = options;

  const aggregateOptions = {
    evolve: (state: GuestStayAccount | null, event: GuestStayAccountEvent) => {
      state ??= GuestStayAccount.initial();

      state.evolve(event);

      return state;
    },
    initial: () => null,
  };

  return {
    checkInGuest: (command: CheckInGuest) => {
      const account = GuestStayAccount.checkInGuest(command.data);

      eventStore.appendToStream(
        command.data.guestStayAccountId,
        account.dequeueUncommitedEvents(),
      );
    },
    recordCharge: (command: RecordCharge) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      if (!account) {
        throw new Error('Entity not found');
      }

      account.recordCharge(command.data);

      eventStore.appendToStream(
        command.data.guestStayAccountId,
        account.dequeueUncommitedEvents(),
      );
    },
    recordPayment: (command: RecordPayment) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      if (!account) {
        throw new Error('Entity not found');
      }

      account.recordPayment(command.data);

      eventStore.appendToStream(
        command.data.guestStayAccountId,
        account.dequeueUncommitedEvents(),
      );
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      if (!account) {
        throw new Error('Entity not found');
      }

      account.checkoutGuest(command.data);

      eventStore.appendToStream(
        command.data.guestStayAccountId,
        account.dequeueUncommitedEvents(),
      );
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

export type GuestStayFacade = ReturnType<typeof GuestStayFacade>;
