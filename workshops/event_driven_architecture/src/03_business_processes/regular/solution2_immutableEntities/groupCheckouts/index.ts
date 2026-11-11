import type { Database, MessageBus } from '../../../tools';
import type { GroupCheckoutInitiated } from './groupCheckout';
import { GroupCheckoutFacade } from './groupCheckoutFacade';

export * from './groupCheckout';
export * from './groupCheckoutFacade';

export const configureGroupCheckouts = ({
  database,
  messageBus,
}: {
  database: Database;
  messageBus: MessageBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const _groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    database,
    messageBus,
  });

  messageBus.subscribe<GroupCheckoutInitiated>('GroupCheckoutInitiated', () => {
    throw new Error('Handle GroupCheckout Initiated event');
  });
  // Add other message bus subscriptions for commands and events when needed

  throw new Error('Configure group checkouts handlers here');
};
