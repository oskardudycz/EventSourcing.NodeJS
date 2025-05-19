import type { CommandBus, EventStore } from '../../../tools';
import {
  type GuestCheckedOut,
  type GuestCheckoutFailed,
} from '../guestStayAccounts';
import { GroupCheckoutFacade } from './groupCheckoutFacade';

export * from './groupCheckout';
export * from './groupCheckoutFacade';

export const configureGroupCheckouts = ({
  eventStore,
  commandBus,
}: {
  eventStore: EventStore;
  commandBus: CommandBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    eventStore,
    commandBus,
  });

  eventStore.subscribe<GuestCheckedOut>(
    'GuestCheckedOut',
    groupCheckoutFacade.onGuestCheckedOut,
  );
  eventStore.subscribe<GuestCheckoutFailed>(
    'GuestCheckoutFailed',
    groupCheckoutFacade.onGuestCheckoutFailed,
  );

  return { groupCheckoutFacade };
};
