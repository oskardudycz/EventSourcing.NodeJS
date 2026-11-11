import type { BackgroundJobs, CommandBus, Database, EventBus } from '../tools';
import type { CheckoutGuest } from './businessLogic';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './businessLogic';
export * from './guestStayAccount';
export * from './guestStayAccountFacade';

export const configureGuestStayAccounts = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
  backgroundJobs: BackgroundJobs;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  const { database, eventBus, commandBus, backgroundJobs } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      database,
      eventBus,
      backgroundJobs,
    },
  );

  commandBus.handle<CheckoutGuest>(
    'CheckoutGuest',
    guestStayAccountFacade.checkoutGuest,
  );

  return { guestStayAccountFacade };
};
