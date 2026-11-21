import type { Database, MessageBus } from '../../../tools';
import type { CheckOutGuest } from './businessLogic';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './businessLogic';
export * from './guestStayAccount';
export * from './guestStayAccountFacade';

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
