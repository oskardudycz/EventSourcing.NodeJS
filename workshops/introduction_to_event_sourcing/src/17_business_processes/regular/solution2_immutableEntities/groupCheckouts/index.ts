import type { CommandBus, EventStore } from '../../../tools';
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
  // TODO: Configure group checkouts handlers here

  return { groupCheckoutFacade };
};
