import type { CommandBus, EventStore } from '../../../tools';
import {
  initiateGroupCheckout,
  recordGuestCheckout,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from './businessLogic';
import { evolve, initial } from './groupCheckout';

export const GroupCheckoutFacade = (options: {
  eventStore: EventStore;
  commandBus: CommandBus;
}) => {
  const { eventStore } = options;

  const aggregateStreamOptions = { evolve, initial: () => initial };

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const groupCheckout = eventStore.aggregateStream(
        command.data.groupCheckoutId,
        aggregateStreamOptions,
      );

      const event = initiateGroupCheckout(command, groupCheckout);
      eventStore.appendToStream(command.data.groupCheckoutId, [event]);
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = eventStore.aggregateStream(
        command.data.groupCheckoutId,
        aggregateStreamOptions,
      );

      const events = recordGuestCheckout(command, groupCheckout);
      eventStore.appendToStream(command.data.groupCheckoutId, events);
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = eventStore.aggregateStream(
        command.data.groupCheckoutId,
        aggregateStreamOptions,
      );

      const events = recordGuestCheckout(command, groupCheckout);
      eventStore.appendToStream(command.data.groupCheckoutId, events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
