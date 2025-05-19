import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type RecordCharge,
  type RecordPayment,
} from '.';
import type { CommandBus, EventStore } from '../../../tools';

export const GuestStayAccountFacade = (options: {
  commandBus: CommandBus;
  eventStore: EventStore;
}) => {
  const { eventStore } = options;

  const aggregateOptions = { evolve, initial: () => initial };

  return {
    checkInGuest: (command: CheckInGuest) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    recordCharge: (command: RecordCharge) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    recordPayment: (command: RecordPayment) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
    checkoutGuest: (command: CheckoutGuest) => {
      const account = eventStore.aggregateStream(
        command.data.guestStayAccountId,
        aggregateOptions,
      );

      const events = decide(command, account);

      eventStore.appendToStream(command.data.guestStayAccountId, events);
    },
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
