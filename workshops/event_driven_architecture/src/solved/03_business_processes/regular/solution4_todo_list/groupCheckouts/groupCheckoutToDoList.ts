import type { MessageBus } from '../../../tools';
import {
  areAnyFailedCheckouts,
  areAnyOngoingCheckouts,
  checkoutsWith,
  type GroupCheckout,
  type GroupCheckoutCompleted,
  type GroupCheckoutFailed,
} from './groupCheckout';
import type {
  GroupCheckoutProjection,
  GroupCheckoutToDoListEvent,
} from './groupCheckoutProjection';

export const GroupCheckoutToDoList = (options: {
  projection: GroupCheckoutProjection;
  messageBus: MessageBus;
}) => {
  const { projection, messageBus } = options;

  const tryComplete = (groupCheckout: GroupCheckout) => {
    if (areAnyOngoingCheckouts(groupCheckout)) return;

    messageBus.publish<GroupCheckoutCompleted | GroupCheckoutFailed>([
      !areAnyFailedCheckouts(groupCheckout)
        ? {
            type: 'GroupCheckoutCompleted',
            data: {
              groupCheckoutId: groupCheckout.id,
              completedCheckouts: checkoutsWith(groupCheckout, 'Completed'),
              completedAt: groupCheckout.updatedAt,
            },
          }
        : {
            type: 'GroupCheckoutFailed',
            data: {
              groupCheckoutId: groupCheckout.id,
              completedCheckouts: checkoutsWith(groupCheckout, 'Completed'),
              failedCheckouts: checkoutsWith(groupCheckout, 'Failed'),
              failedAt: groupCheckout.updatedAt,
            },
          },
    ]);
  };

  return {
    canHandle: projection.canHandle,
    handle: (event: GroupCheckoutToDoListEvent) => {
      const groupCheckout = projection.handle(event);

      if (groupCheckout !== null) tryComplete(groupCheckout);
    },
    tryComplete,
  };
};

export type GroupCheckoutToDoList = ReturnType<typeof GroupCheckoutToDoList>;
