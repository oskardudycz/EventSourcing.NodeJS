import type { CommandBus, EventStore } from '../../../tools';
import { GuestStayAccountFacade } from './guestStayAccountFacade';

export * from './guestStayAccount';
export * from './guestStayAccountFacade';

export const configureGuestStayAccounts = (options: {
  eventStore: EventStore;
  commandBus: CommandBus;
}): { guestStayAccountFacade: GuestStayAccountFacade } => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { eventStore, commandBus } = options;

  const guestStayAccountFacade: GuestStayAccountFacade = GuestStayAccountFacade(
    {
      eventStore,
    },
  );

  // TODO: Configure guest stay accounts handlers here

  return { guestStayAccountFacade };
};
