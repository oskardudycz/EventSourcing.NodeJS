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

export type GroupCheckoutSagaEvent =
  | GroupCheckoutInitiated
  | GuestCheckedOut
  | GuestCheckoutFailed;

export type GroupCheckoutSagaCommand =
  | CheckoutGuest
  | RecordGuestCheckoutCompletion
  | RecordGuestCheckoutFailure;

export const GroupCheckoutSaga = ({
  type,
  data: event,
}: GroupCheckoutSagaEvent): GroupCheckoutSagaCommand[] => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      return event.guestStayAccountIds.map<GroupCheckoutSagaCommand>((id) => {
        return {
          type: 'CheckoutGuest',
          data: {
            guestStayAccountId: id,
            now: event.initiatedAt,
            groupCheckoutId: event.groupCheckoutId,
          },
        };
      });
    }
    case 'GuestCheckedOut': {
      if (!event.groupCheckoutId) return [];

      return [
        {
          type: 'RecordGuestCheckoutCompletion',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            guestStayAccountId: event.guestStayAccountId,
            now: event.checkedOutAt,
          },
        },
      ];
    }
    case 'GuestCheckoutFailed': {
      if (!event.groupCheckoutId) return [];

      return [
        {
          type: 'RecordGuestCheckoutFailure',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            guestStayAccountId: event.guestStayAccountId,
            now: event.failedAt,
          },
        },
      ];
    }
  }
};
