import { GuestStayAccount, type GuestStayAccountEvent } from '.';
import type { EventStore } from '../../../tools';

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

export const GuestStayAccountFacade = (options: { eventStore: EventStore }) => {
  const { eventStore } = options;

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
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
