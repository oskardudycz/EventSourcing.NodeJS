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
  type EventBus,
} from '../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  eventBus: EventBus;
  backgroundJobs: BackgroundJobs;
}) => {
  const { database, eventBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const events = decide(command, initial);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, initial),
        { expectedVersion: 0 },
      );

      await eventBus.publish(events);
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

      await eventBus.publish(events);
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

      await eventBus.publish(events);
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

      await eventBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
