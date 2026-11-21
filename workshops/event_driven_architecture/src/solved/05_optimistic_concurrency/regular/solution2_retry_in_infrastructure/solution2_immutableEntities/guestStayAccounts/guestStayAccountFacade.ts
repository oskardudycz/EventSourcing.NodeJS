import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type GuestStayAccount,
  type RecordCharge,
  type RecordPayment,
} from '.';
import type { Database, MessageBus } from '../../../../tools';
import { CommandHandler } from '../../core';

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = CommandHandler({
    collection: database.collection<GuestStayAccount>('guestStayAccount'),
    evolve,
    initial,
  });

  return {
    checkInGuest: async (command: CheckInGuest) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (state) => decide(command, state),
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordCharge: async (command: RecordCharge) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (state) => {
          if (state.status === 'NotExisting')
            throw new Error('Entity not found');

          return decide(command, state);
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordPayment: async (command: RecordPayment) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (state) => {
          if (state.status === 'NotExisting')
            throw new Error('Entity not found');

          return decide(command, state);
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    checkoutGuest: async (command: CheckoutGuest) => {
      const events = await accounts.handle(
        command.data.guestStayAccountId,
        (state) =>
          state.status === 'NotExisting' ? [] : decide(command, state),
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
