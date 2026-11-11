import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type GuestStayAccount,
  type RecordCharge,
  type RecordPayment,
} from '.';
import {
  retryOnConflict,
  type BackgroundJobs,
  type Database,
  type MessageBus,
} from '../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
  backgroundJobs: BackgroundJobs;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const events = decide(command, initial);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, initial),
        { expectedVersion: 0 },
      );

      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const events = await retryOnConflict(async () => {
        const existing = await accounts.get(command.data.guestStayAccountId);
        const account = existing?.document ?? initial;

        const events = decide(command, account);

        await accounts.store(
          command.data.guestStayAccountId,
          events.reduce(evolve, account),
          { expectedVersion: existing?.version ?? 0 },
        );

        return events;
      });

      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const events = await retryOnConflict(async () => {
        const existing = await accounts.get(command.data.guestStayAccountId);
        const account = existing?.document ?? initial;

        const events = decide(command, account);

        await accounts.store(
          command.data.guestStayAccountId,
          events.reduce(evolve, account),
          { expectedVersion: existing?.version ?? 0 },
        );

        return events;
      });

      await messageBus.publish(events);
    },
    checkoutGuest: async (command: CheckoutGuest) => {
      const events = await retryOnConflict(async () => {
        const existing = await accounts.get(command.data.guestStayAccountId);
        const account = existing?.document ?? initial;

        const events = decide(command, account);

        await accounts.store(
          command.data.guestStayAccountId,
          events.reduce(evolve, account),
          { expectedVersion: existing?.version ?? 0 },
        );

        return events;
      });

      await messageBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
