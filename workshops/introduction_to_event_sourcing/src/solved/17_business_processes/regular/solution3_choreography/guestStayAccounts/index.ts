import type { CommandBus, EventStore } from '../../../tools';
import type { GroupCheckoutInitiated } from '../groupCheckouts';
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

  eventStore.subscribe<GroupCheckoutInitiated>(
    'GroupCheckoutInitiated',
    (event) => {
      const { groupCheckoutId, guestStayAccountIds } = event.data;

      for (const guestStayAccountId of guestStayAccountIds)
        guestStayAccountFacade.checkoutGuest({
          type: 'CheckoutGuest',
          data: {
            guestStayAccountId,
            groupCheckoutId,
            now: event.data.initiatedAt,
          },
        });
    },
  );

  return { guestStayAccountFacade };
};
