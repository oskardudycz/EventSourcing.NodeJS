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
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      if (groupCheckouts.get(command.data.groupCheckoutId)) return;

      const groupCheckout =
        groupCheckouts.get(command.data.groupCheckoutId) ?? initial;

      const event = initiateGroupCheckout(command, groupCheckout);

      groupCheckouts.store(
        command.data.groupCheckoutId,
        evolve(groupCheckout, event),
      );
      messageBus.publish([event]);
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      const events = recordGuestCheckout(command, groupCheckout);

      groupCheckouts.store(
        command.data.groupCheckoutId,
        events.reduce(evolve, groupCheckout),
      );
      messageBus.publish(events);
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      const events = recordGuestCheckout(command, groupCheckout);

      groupCheckouts.store(
        command.data.groupCheckoutId,
        events.reduce(evolve, groupCheckout),
      );
      messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
