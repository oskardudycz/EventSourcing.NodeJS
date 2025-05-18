import type { CommandBus, Database, EventBus } from '../../../tools';
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
  eventBus: EventBus;
  commandBus: CommandBus;
}) => {
  const { database, eventBus } = options;

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
      eventBus.publish([event]);
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
      eventBus.publish(events);
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
      eventBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
