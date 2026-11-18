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
    onGuestCheckedOut: ({ data: event }: GuestCheckedOut) => {
      if (!event.groupCheckoutId) return;

      messageBus.publish<RecordGuestCheckoutCompletion>([
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
    onGuestCheckoutFailed: ({ data: event }: GuestCheckoutFailed) => {
      if (!event.groupCheckoutId) return;

      messageBus.publish<RecordGuestCheckoutFailure>([
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
