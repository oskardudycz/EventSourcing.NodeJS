import type { CommandBus, Database, EventBus } from '../../../tools';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './guestStayAccount';
export * from './guestStayAccountFacade';

export const configureGuestStayAccounts = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { database, eventBus, commandBus } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      database,
      eventBus,
    },
  );

  // TODO: Configure guest stay accounts handlers here

  return { guestStayAccountFacade };
};
