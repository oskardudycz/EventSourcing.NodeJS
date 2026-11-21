import type { MessageBus } from '../../../tools';
import type {
  CheckoutGuest,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import type {
  RecordGuestCheckoutCompletion,
  RecordGuestCheckoutFailure,
} from './businessLogic';

import type { GroupCheckoutInitiated } from './groupCheckout';

export const GroupCheckoutSaga = (options: { messageBus: MessageBus }) => {
  const { messageBus } = options;

  return {
    onGroupCheckoutInitiated: ({ data: event }: GroupCheckoutInitiated) =>
      messageBus.publish<CheckoutGuest>(
        event.guestStayAccountIds.map((id) => ({
          type: 'CheckoutGuest',
          data: {
            guestStayAccountId: id,
            now: event.initiatedAt,
            groupCheckoutId: event.groupCheckoutId,
          },
        })),
      ),
    onGuestCheckedOut: async ({ data: event }: GuestCheckedOut) => {
      if (!event.groupCheckoutId) return;

      await messageBus.publish<RecordGuestCheckoutCompletion>([
        {
          type: 'RecordGuestCheckoutCompletion',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            guestStayAccountId: event.guestStayAccountId,
            now: event.checkedOutAt,
          },
        },
      ]);
    },
    onGuestCheckoutFailed: async ({ data: event }: GuestCheckoutFailed) => {
      if (!event.groupCheckoutId) return;

      await messageBus.publish<RecordGuestCheckoutFailure>([
        {
          type: 'RecordGuestCheckoutFailure',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            guestStayAccountId: event.guestStayAccountId,
            now: event.failedAt,
          },
        },
      ]);
    },
  };
};
