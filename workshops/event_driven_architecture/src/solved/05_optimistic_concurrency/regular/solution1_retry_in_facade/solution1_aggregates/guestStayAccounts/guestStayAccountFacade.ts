import { GuestStayAccount } from '.';
import {
  retryOnConflict,
  type Database,
  type MessageBus,
} from '../../../../tools';

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
  CheckInGuest | RecordCharge | RecordPayment | CheckoutGuest;

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>(
    'guestStayAccount',
    GuestStayAccount,
  );

  const handle = async (
    id: string,
    run: (account: GuestStayAccount | null) => GuestStayAccount | null,
  ) => {
    const events = await retryOnConflict(async () => {
      const existing = await accounts.get(id);
      const account = run(existing?.document ?? null);

      if (!account) return [];

      const events = account.dequeueUncommitedEvents();

      if (events.length === 0) return events;

      await accounts.store(id, account, {
        expectedVersion: existing?.version ?? 0,
      });

      return events;
    });

    if (events.length === 0) return;

    await messageBus.publish(events);
  };

  return {
    checkInGuest: (command: CheckInGuest) =>
      handle(command.data.guestStayAccountId, (account) =>
        account ? null : GuestStayAccount.checkInGuest(command.data),
      ),
    recordCharge: (command: RecordCharge) =>
      handle(command.data.guestStayAccountId, (account) => {
        if (!account) throw new Error('Entity not found');

        account.recordCharge(command.data);

        return account;
      }),
    recordPayment: (command: RecordPayment) =>
      handle(command.data.guestStayAccountId, (account) => {
        if (!account) throw new Error('Entity not found');

        account.recordPayment(command.data);

        return account;
      }),
    checkoutGuest: (command: CheckoutGuest) =>
      handle(command.data.guestStayAccountId, (account) => {
        account?.checkoutGuest(command.data);

        return account;
      }),
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
