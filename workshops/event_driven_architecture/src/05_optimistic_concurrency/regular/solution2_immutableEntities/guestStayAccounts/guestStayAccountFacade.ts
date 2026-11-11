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
import type { Database, EventBus } from '../../../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  eventBus: EventBus;
}) => {
  const { database, eventBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const account =
        (await accounts.get(command.data.guestStayAccountId))?.document ??
        initial;

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await eventBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const account =
        (await accounts.get(command.data.guestStayAccountId))?.document ??
        initial;

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await eventBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const account =
        (await accounts.get(command.data.guestStayAccountId))?.document ??
        initial;

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await eventBus.publish(events);
    },
    checkoutGuest: async (command: CheckoutGuest) => {
      const account =
        (await accounts.get(command.data.guestStayAccountId))?.document ??
        initial;

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await eventBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
