import type { Database, MessageBus } from '../../../tools';
import type {
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import { GroupCheckoutFacade } from './groupCheckoutFacade';

export * from './businessLogic';
export * from './groupCheckout';
export * from './groupCheckoutFacade';

export const configureGroupCheckouts = ({
  database,
  messageBus,
}: {
  database: Database;
  messageBus: MessageBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    database,
    messageBus,
  });

  messageBus.subscribe<GuestCheckedOut>(
    'GuestCheckedOut',
    groupCheckoutFacade.onGuestCheckoutResult,
  );
  messageBus.subscribe<GuestCheckoutFailed>(
    'GuestCheckoutFailed',
    groupCheckoutFacade.onGuestCheckoutResult,
  );

  return { groupCheckoutFacade };
};
