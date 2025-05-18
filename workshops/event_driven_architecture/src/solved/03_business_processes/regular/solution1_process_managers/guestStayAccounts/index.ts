import type { CommandBus, Database, EventBus } from '../../../tools';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

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
  // TODO: Configure guest stay handlers here

  return { guestStayAccountFacade };
};
