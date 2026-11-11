import type { Database, MessageBus } from '../../../tools';
import type { GroupCheckout } from './groupCheckout';
import { GroupCheckoutFacade } from './groupCheckoutFacade';
import {
  GroupCheckoutProjection,
  type GroupCheckoutToDoListEvent,
} from './groupCheckoutProjection';
import { GroupCheckoutToDoList } from './groupCheckoutToDoList';

export * from './groupCheckout';
export * from './groupCheckoutFacade';
export * from './groupCheckoutProjection';
export * from './groupCheckoutToDoList';
export * from './scheduledGroupCheckoutToDoList';

export const configureGroupCheckouts = ({
  database,
  messageBus,
}: {
  database: Database;
  messageBus: MessageBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutToDoList = GroupCheckoutToDoList({
    projection: GroupCheckoutProjection(
      database.collection<GroupCheckout>('groupCheckout'),
    ),
    messageBus,
  });

  for (const eventType of groupCheckoutToDoList.canHandle) {
    messageBus.subscribe<GroupCheckoutToDoListEvent>(
      eventType,
      groupCheckoutToDoList.handle,
    );
  }

  return { groupCheckoutFacade: GroupCheckoutFacade({ messageBus }) };
};
