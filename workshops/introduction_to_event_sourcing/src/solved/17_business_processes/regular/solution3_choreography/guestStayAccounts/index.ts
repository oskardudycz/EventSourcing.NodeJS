import type { CommandBus, Database, EventBus } from '../../../tools';
import type { GroupCheckoutInitiated } from '../groupCheckouts';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './businessLogic';
export * from './guestStayAccount';
export * from './guestStayAccountFacade';

export const configureGuestStayAccounts = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  const { database, eventBus } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      database,
      eventBus,
    },
  );

  eventBus.subscribe<GroupCheckoutInitiated>(
    'GroupCheckoutInitiated',
    guestStayAccountFacade.onGroupCheckout,
  );

  return { guestStayAccountFacade };
};
