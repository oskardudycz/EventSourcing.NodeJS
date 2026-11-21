import type { Database, MessageBus } from '../../../tools';
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
      if (await groupCheckouts.get(command.data.groupCheckoutId)) return;

      const groupCheckout =
        (await groupCheckouts.get(command.data.groupCheckoutId))?.document ??
        initial;

      const event = initiateGroupCheckout(command);

      await groupCheckouts.store(
        command.data.groupCheckoutId,
        evolve(groupCheckout, event),
      );
      await messageBus.publish([event]);
    },
    recordGuestCheckoutCompletion: async (
      command: RecordGuestCheckoutCompletion,
    ) => {
      const existing = await groupCheckouts.get(command.data.groupCheckoutId);

      if (!existing) {
        return;
      }

      const groupCheckout = existing.document;

      const events = recordGuestCheckout(command, groupCheckout);

      await groupCheckouts.store(
        command.data.groupCheckoutId,
        events.reduce(evolve, groupCheckout),
      );
      await messageBus.publish(events);
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const existing = await groupCheckouts.get(command.data.groupCheckoutId);

      if (!existing) {
        return;
      }

      const groupCheckout = existing.document;

      const events = recordGuestCheckout(command, groupCheckout);

      await groupCheckouts.store(
        command.data.groupCheckoutId,
        events.reduce(evolve, groupCheckout),
      );
      await messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
