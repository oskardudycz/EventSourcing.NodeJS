import { GuestStayAccount } from '.';
import type { Database, MessageBus } from '../../../tools';

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

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: async (command: CheckInGuest) => {
      if (await accounts.get(command.data.guestStayAccountId)) return;

      const account = GuestStayAccount.checkInGuest(command.data);

      const events = account.dequeueUncommitedEvents();

      await accounts.store(command.data.guestStayAccountId, account);
      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const existing = await accounts.get(command.data.guestStayAccountId);

      if (!existing) {
        throw new Error('Entity not found');
      }

      const account = existing.document;

      account.recordCharge(command.data);

      const events = account.dequeueUncommitedEvents();

      await accounts.store(command.data.guestStayAccountId, account);
      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const existing = await accounts.get(command.data.guestStayAccountId);

      if (!existing) {
        throw new Error('Entity not found');
      }

      const account = existing.document;

      account.recordPayment(command.data);

      const events = account.dequeueUncommitedEvents();

      await accounts.store(command.data.guestStayAccountId, account);
      await messageBus.publish(events);
    },
    checkoutGuest: async (command: CheckoutGuest) => {
      const existing = await accounts.get(command.data.guestStayAccountId);

      if (!existing) {
        throw new Error('Entity not found');
      }

      const account = existing.document;

      account.checkoutGuest(command.data);

      const events = account.dequeueUncommitedEvents();

      await accounts.store(command.data.guestStayAccountId, account);
      await messageBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
