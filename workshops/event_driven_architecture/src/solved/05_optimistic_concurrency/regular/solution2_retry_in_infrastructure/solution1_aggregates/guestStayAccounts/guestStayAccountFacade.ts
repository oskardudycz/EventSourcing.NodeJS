import { GuestStayAccount } from '.';
import type { Database, MessageBus } from '../../../../tools';
import { AggregateStore } from '../../core';

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

  const accounts = AggregateStore(
    database.collection<GuestStayAccount>('guestStayAccount', GuestStayAccount),
  );

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (account) => (account ? null : GuestStayAccount.checkIn(command.data)),
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (account) => {
          if (!account) throw new Error('Entity not found');

          account.recordCharge(command.data);

          return account;
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (account) => {
          if (!account) throw new Error('Entity not found');

          account.recordPayment(command.data);

          return account;
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    checkOutGuest: async (command: CheckOutGuest) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (account) => {
          account?.checkout(command.data);

          return account;
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
