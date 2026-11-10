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
import { storeAndPublish, type Database, type EventBus } from '../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  eventBus: EventBus;
}) => {
  const { database, eventBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: (command: CheckInGuest) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      storeAndPublish({ database, eventBus }, events, (transaction) =>
        transaction
          .collection<GuestStayAccount>('guestStayAccount')
          .store(
            command.data.guestStayAccountId,
            events.reduce(evolve, account),
          ),
      );
    },
    recordCharge: (command: RecordCharge) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      storeAndPublish({ database, eventBus }, events, (transaction) =>
        transaction
          .collection<GuestStayAccount>('guestStayAccount')
          .store(
            command.data.guestStayAccountId,
            events.reduce(evolve, account),
          ),
      );
    },
    recordPayment: (command: RecordPayment) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      storeAndPublish({ database, eventBus }, events, (transaction) =>
        transaction
          .collection<GuestStayAccount>('guestStayAccount')
          .store(
            command.data.guestStayAccountId,
            events.reduce(evolve, account),
          ),
      );
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      storeAndPublish({ database, eventBus }, events, (transaction) =>
        transaction
          .collection<GuestStayAccount>('guestStayAccount')
          .store(
            command.data.guestStayAccountId,
            events.reduce(evolve, account),
          ),
      );
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
