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
import type { Database, MessageBus } from '../../../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

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
      await messageBus.publish(events);
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
      await messageBus.publish(events);
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
      await messageBus.publish(events);
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
      await messageBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
