import type { MessageBus } from '../../../tools';
import type { CheckOutGuest } from '../guestStayAccounts';
import type { GroupCheckoutInitiated } from './groupCheckout';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    now: Date;
  };
};

export type GroupCheckoutCommand = InitiateGroupCheckout;

export const GroupCheckoutFacade = (options: { messageBus: MessageBus }) => {
  const { messageBus } = options;

  return {
    initiateGroupCheckout: async ({ data: command }: InitiateGroupCheckout) => {
      await messageBus.publish<GroupCheckoutInitiated | CheckOutGuest>([
        {
          type: 'GroupCheckoutInitiated',
          data: {
            groupCheckoutId: command.groupCheckoutId,
            clerkId: command.clerkId,
            guestStayAccountIds: command.guestStayAccountIds,
            initiatedAt: command.now,
          },
        },
        ...command.guestStayAccountIds.map(
          (guestStayAccountId): CheckOutGuest => ({
            type: 'CheckOutGuest',
            data: {
              guestStayAccountId,
              now: command.now,
              groupCheckoutId: command.groupCheckoutId,
            },
          }),
        ),
      ]);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
