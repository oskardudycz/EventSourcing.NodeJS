import type { Database, MessageBus } from '../../../tools';
import type {
  CheckOutGuest,
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
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const groupCheckout =
        (await groupCheckouts.get(command.data.groupCheckoutId)) ?? initial;

      const event = initiateGroupCheckout(command);

      await groupCheckouts.store(
        command.data.groupCheckoutId,
        evolve(groupCheckout, event),
      );
      await messageBus.publish([event]);

      await messageBus.publish<CheckOutGuest>(
        event.data.guestStayAccountIds.map((guestStayAccountId) => ({
          type: 'CheckOutGuest',
          data: {
            guestStayAccountId,
            now: event.data.initiatedAt,
            groupCheckoutId: event.data.groupCheckoutId,
          },
        })),
      );
    },
    onGuestCheckoutResult: async (
      event: GuestCheckedOut | GuestCheckoutFailed,
    ) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = await groupCheckouts.get(
        event.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      const command:
        RecordGuestCheckoutCompletion | RecordGuestCheckoutFailure =
        event.type === 'GuestCheckedOut'
          ? {
              type: 'RecordGuestCheckoutCompletion',
              data: {
                groupCheckoutId: event.data.groupCheckoutId,
                guestStayAccountId: event.data.guestStayAccountId,
                now: event.data.completedAt,
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

      await groupCheckouts.store(
        event.data.groupCheckoutId,
        events.reduce(evolve, groupCheckout),
      );
      await messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
