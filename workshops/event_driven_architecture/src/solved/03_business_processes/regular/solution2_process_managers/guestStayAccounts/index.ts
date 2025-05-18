import type { CommandBus, Database, EventBus } from '../../../tools';
import {
  type CheckoutGuest,
  GuestStayAccountFacade,
} from './guestStayAccountFacade';

export * from './guestStayAccount';
export * from './guestStayAccountFacade';

export const configureGuestStayAccounts = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  const { database, eventBus, commandBus } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      database,
      eventBus,
    },
  );

  commandBus.handle<CheckoutGuest>(
    'CheckoutGuest',
    guestStayAccountFacade.checkoutGuest,
  );

  return { guestStayAccountFacade };
};
