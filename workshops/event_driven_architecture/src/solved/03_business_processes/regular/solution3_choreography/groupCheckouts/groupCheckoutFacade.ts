import type { Database, MessageBus } from '../../../tools';
import type {
  CheckoutGuest,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import {
  initiateGroupCheckout,
  recordGuestCheckout,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from './businessLogic';
import { evolve, initial, type GroupCheckout } from './groupCheckout';

export const GroupCheckoutFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const groupCheckouts = database.collection<GroupCheckout>('groupCheckout');

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const groupCheckout =
        groupCheckouts.get(command.data.groupCheckoutId) ?? initial;

      const event = initiateGroupCheckout(command, groupCheckout);

      groupCheckouts.store(
        command.data.groupCheckoutId,
        evolve(groupCheckout, event),
      );
      messageBus.publish([event]);

      messageBus.publish<CheckoutGuest>(
        event.data.guestStayAccountIds.map((guestStayAccountId) => ({
          type: 'CheckoutGuest',
          data: {
            guestStayAccountId,
            now: event.data.initiatedAt,
            groupCheckoutId: event.data.groupCheckoutId,
          },
        })),
      );
    },
    onGuestCheckoutResult: (event: GuestCheckedOut | GuestCheckoutFailed) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = groupCheckouts.get(event.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      const command:
        | RecordGuestCheckoutCompletion
        | RecordGuestCheckoutFailure =
        event.type === 'GuestCheckedOut'
          ? {
              type: 'RecordGuestCheckoutCompletion',
              data: {
                groupCheckoutId: event.data.groupCheckoutId,
                guestStayAccountId: event.data.guestStayAccountId,
                now: event.data.checkedOutAt,
              },
            }
          : {
              type: 'RecordGuestCheckoutFailure',
              data: {
                groupCheckoutId: event.data.groupCheckoutId,
                guestStayAccountId: event.data.guestStayAccountId,
                now: event.data.failedAt,
              },
            };

      const events = recordGuestCheckout(command, groupCheckout);

      groupCheckouts.store(
        event.data.groupCheckoutId,
        events.reduce(evolve, groupCheckout),
      );
      messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
