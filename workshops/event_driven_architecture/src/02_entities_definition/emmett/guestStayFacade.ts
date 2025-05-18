import type { Database, EventBus } from '../tools';
import type { GuestStayAccountEvent } from './guestStayAccounts';

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

  const accounts = database.collection('guestStayAccount');

  return {
    checkInGuest: (_command: CheckInGuest) => {
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    recordCharge: (command: RecordCharge) => {
      const account = accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      // TODO: Fill the business logic implementation calling your entity/aggregate
      // e.g. account.doSomething;
      const events: GuestStayAccountEvent[] = []; // fill your events

      accounts.store(command.data.guestStayAccountId, account);
      eventBus.publish(events);
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    recordPayment: (_command: RecordPayment) => {
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    checkoutGuest: (_command: CheckoutGuest) => {
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    initiateGroupCheckout: (_command: InitiateGroupCheckout) => {
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
  };
};
