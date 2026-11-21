import type { Database, MessageBus } from '../../../../tools';
import type { CheckOutGuest } from './guestStayAccountFacade';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './guestStayAccountFacade';
export * from './guestStayAccount';

export const configureGuestStayAccounts = (options: {
  database: Database;
  messageBus: MessageBus;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  const { database, messageBus } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      database,
      messageBus,
    },
  );

  messageBus.subscribe<CheckOutGuest>(
    'CheckOutGuest',
    guestStayAccountFacade.checkOutGuest,
  );

  return { guestStayAccountFacade };
};
