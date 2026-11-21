import type { Database, MessageBus } from '../../../../tools';
import { CommandHandler } from '../../core';
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

  const groupCheckouts = CommandHandler({
    collection: database.collection<GroupCheckout>('groupCheckout'),
    evolve,
    initial,
  });

  return {
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const events = await groupCheckouts.handle(
        command.data.groupCheckoutId,
        (state) =>
          state.status === 'NotExisting'
            ? [initiateGroupCheckout(command)]
            : [],
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordGuestCheckoutCompletion: async (
      command: RecordGuestCheckoutCompletion,
    ) => {
      const events = await groupCheckouts.handle(
        command.data.groupCheckoutId,
        (state) =>
          state.status === 'NotExisting'
            ? []
            : recordGuestCheckout(command, state),
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const events = await groupCheckouts.handle(
        command.data.groupCheckoutId,
        (state) =>
          state.status === 'NotExisting'
            ? []
            : recordGuestCheckout(command, state),
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
