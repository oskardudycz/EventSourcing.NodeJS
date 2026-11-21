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

  const tryComplete = async (groupCheckout: GroupCheckout) => {
    if (areAnyOngoingCheckouts(groupCheckout)) return;

    await messageBus.publish<GroupCheckoutCompleted | GroupCheckoutFailed>([
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
    handle: async (event: GroupCheckoutToDoListEvent) => {
      const groupCheckout = await projection.handle(event);

      if (groupCheckout !== null) await tryComplete(groupCheckout);
    },
    tryComplete,
  };
};

export type GroupCheckoutToDoList = ReturnType<typeof GroupCheckoutToDoList>;
