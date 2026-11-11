import type { MessageBus } from '../../../tools';
import type { CheckoutGuest } from '../guestStayAccounts';
import type { GroupCheckoutInitiated } from './groupCheckout';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayIds: string[];
    now: Date;
  };
};

export type GroupCheckoutCommand = InitiateGroupCheckout;

export const GroupCheckoutFacade = (options: { messageBus: MessageBus }) => {
  const { messageBus } = options;

  return {
    initiateGroupCheckout: ({ data: command }: InitiateGroupCheckout) => {
      messageBus.publish<GroupCheckoutInitiated | CheckoutGuest>([
        {
          type: 'GroupCheckoutInitiated',
          data: {
            groupCheckoutId: command.groupCheckoutId,
            clerkId: command.clerkId,
            guestStayAccountIds: command.guestStayIds,
            initiatedAt: command.now,
          },
        },
        ...command.guestStayIds.map(
          (guestStayAccountId): CheckoutGuest => ({
            type: 'CheckoutGuest',
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
