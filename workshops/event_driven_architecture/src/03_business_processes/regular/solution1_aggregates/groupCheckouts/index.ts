import type { CommandBus, Database, EventBus } from '../../../tools';
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
  // TODO: Configure group checkouts handlers here

  return { groupCheckoutFacade };
};
