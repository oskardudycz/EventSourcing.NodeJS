import {
  storeAndPublish,
  type CommandBus,
  type Database,
  type EventBus,
} from '../tools';
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
      if (groupCheckouts.get(command.data.groupCheckoutId)) return;

      const groupCheckout =
        groupCheckouts.get(command.data.groupCheckoutId) ?? initial;

      const event = initiateGroupCheckout(command, groupCheckout);

      storeAndPublish({ database, eventBus }, [event], (transaction) =>
        transaction
          .collection<GroupCheckout>('groupCheckout')
          .store(command.data.groupCheckoutId, evolve(groupCheckout, event)),
      );
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      const events = recordGuestCheckout(command, groupCheckout);

      storeAndPublish({ database, eventBus }, events, (transaction) =>
        transaction
          .collection<GroupCheckout>('groupCheckout')
          .store(
            command.data.groupCheckoutId,
            events.reduce(evolve, groupCheckout),
          ),
      );
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      const events = recordGuestCheckout(command, groupCheckout);

      storeAndPublish({ database, eventBus }, events, (transaction) =>
        transaction
          .collection<GroupCheckout>('groupCheckout')
          .store(
            command.data.groupCheckoutId,
            events.reduce(evolve, groupCheckout),
          ),
      );
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
