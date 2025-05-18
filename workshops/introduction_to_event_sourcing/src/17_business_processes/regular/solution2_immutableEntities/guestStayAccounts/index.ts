import type { CommandBus, EventStore } from '../../../tools';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './businessLogic';
export * from './guestStayAccount';
export * from './guestStayAccountFacade';

export const configureGuestStayAccounts = (options: {
  eventStore: EventStore;
  commandBus: CommandBus;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  const { eventStore, commandBus } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      eventStore,
      commandBus,
    },
  );

  // TODO: Configure guest stay accounts handlers here

  return { guestStayAccountFacade };
};
