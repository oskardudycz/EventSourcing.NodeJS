import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckOutGuest,
  type GuestStayAccount,
  type RecordCharge,
  type RecordPayment,
} from '.';
import type { Database, MessageBus } from '../../../../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const account =
        (await accounts.get(command.data.guestStayAccountId)) ?? initial;

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        throw new Error('Entity not found');
      }

      const events = decide(command, account);

      await accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      await messageBus.publish(events);
    },
    checkOutGuest: async (command: CheckOutGuest) => {
      const account = await accounts.get(command.data.guestStayAccountId);

      if (!account) {
        return;
      }

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
