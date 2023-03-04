import {
  CheckOut,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts/guestStayAccount';
import {
  GroupCheckoutInitiated,
  RecordGuestCheckoutCompletion,
  RecordGuestCheckoutFailure,
  RecordGuestCheckoutsInitiation,
} from './groupCheckout';

export type GroupCheckoutSagaEvent =
  | GroupCheckoutInitiated
  | GuestCheckedOut
  | GuestCheckoutFailed;

export type GroupCheckoutSagaCommand =
  | CheckOut
  | RecordGuestCheckoutsInitiation
  | RecordGuestCheckoutCompletion
  | RecordGuestCheckoutFailure;

export const GroupCheckoutSaga = ({
  type,
  data: event,
}: GroupCheckoutSagaEvent):
  | GroupCheckoutSagaCommand
  | GroupCheckoutSagaCommand[] => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      const checkoutGuestStays =
        event.guestStayAccountIds.map<GroupCheckoutSagaCommand>((id) => {
          return {
            type: 'CheckOut',
            data: {
              guestStayAccountId: id,
              now: event.initiatedAt,
              groupCheckoutId: event.groupCheckoutId,
            },
          };
        });

      return [
        ...checkoutGuestStays,
        {
          type: 'RecordGuestCheckoutsInitiation',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            initiatedGuestStayIds: event.guestStayAccountIds,
            now: event.initiatedAt,
          },
        },
      ];
    }
    case 'GuestCheckedOut': {
      if (!event.groupCheckoutId) return [];

      return {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId: event.groupCheckoutId,
          guestStayAccountId: event.guestStayAccountId,
          now: event.checkedOutAt,
        },
      };
    }
    case 'GuestCheckoutFailed': {
      if (!event.groupCheckoutId) return [];

      return {
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId: event.groupCheckoutId,
          guestStayAccountId: event.guestStayAccountId,
          now: event.failedAt,
        },
      };
    }
  }
};
