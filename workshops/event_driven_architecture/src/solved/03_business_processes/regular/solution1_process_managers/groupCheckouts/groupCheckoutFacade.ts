import type { GroupCheckoutInitiated, InitiateGroupCheckout } from '.';
import type { CommandBus, Database, EventBus } from '../../../tools';

export const GroupCheckoutFacade = (options: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}) => {
  const { database, eventBus } = options;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const groupCheckouts = database.collection('groupCheckout');

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const event: GroupCheckoutInitiated = {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId: command.data.groupCheckoutId,
          clerkId: command.data.clerkId,
          guestStayAccountIds: command.data.guestStayIds,
          initiatedAt: command.data.now,
        },
      };

      eventBus.publish([event]);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
