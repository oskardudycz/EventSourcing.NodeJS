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
import type { GroupCheckoutInitiated } from '../groupCheckouts';

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

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      eventBus.publish(events);
    },
    recordCharge: (command: RecordCharge) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      eventBus.publish(events);
    },
    recordPayment: (command: RecordPayment) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      eventBus.publish(events);
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = accounts.get(command.data.guestStayAccountId) ?? initial;

      const events = decide(command, account);

      accounts.store(
        command.data.guestStayAccountId,
        events.reduce(evolve, account),
      );
      eventBus.publish(events);
    },
    onGroupCheckout: (event: GroupCheckoutInitiated) => {
      // This could be transactional also or we could do fan out based on ids
      for (const guestStayAccountId of event.data.guestStayAccountIds) {
        const account = accounts.get(guestStayAccountId) ?? initial;

        const command: CheckoutGuest = {
          type: 'CheckoutGuest',
          data: {
            groupCheckoutId: event.data.groupCheckoutId,
            guestStayAccountId,
            now: event.data.initiatedAt,
          },
        };

        const events = decide(command, account);

        accounts.store(guestStayAccountId, events.reduce(evolve, account));
        eventBus.publish(events);
      }
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
