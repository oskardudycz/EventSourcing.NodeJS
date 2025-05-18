import type { CommandBus, Database, EventBus } from '../../../tools';
import {
  type GuestCheckedOut,
  type GuestCheckoutFailed,
} from '../guestStayAccounts';
import { GroupCheckoutFacade } from './groupCheckoutFacade';

export * from './groupCheckout';
export * from './groupCheckoutFacade';

export const configureGroupCheckouts = ({
  database,
  eventBus,
  commandBus,
}: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    database,
    eventBus,
    commandBus,
  });

  eventBus.subscribe<GuestCheckedOut>(
    'GuestCheckedOut',
    groupCheckoutFacade.onGuestCheckedOut,
  );
  eventBus.subscribe<GuestCheckoutFailed>(
    'GuestCheckoutFailed',
    groupCheckoutFacade.onGuestCheckoutFailed,
  );

  return { groupCheckoutFacade };
};
