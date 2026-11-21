import { GuestStayAccount } from '.';
import type { Database, MessageBus } from '../../../tools';

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

export const GuestStayAccountFacade = (options: {
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
        return;
      }

      account.checkout(command.data);

      const events = account.dequeueUncommittedEvents();

      await accounts.store(command.data.guestStayAccountId, account);

      await messageBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
