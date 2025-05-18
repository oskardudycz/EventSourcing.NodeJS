import type { EventStore } from '../../../tools';
import type {
  GroupCheckoutEvent,
  GroupCheckoutInitiated,
} from './groupCheckout';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayIds: string[];
    now: Date;
  };
};

export type RecordGuestCheckoutCompletion = {
  type: 'RecordGuestCheckoutCompletion';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    now: Date;
  };
};

export type RecordGuestCheckoutFailure = {
  type: 'RecordGuestCheckoutFailure';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    now: Date;
  };
};

export type GroupCheckoutCommand =
  | InitiateGroupCheckout
  | RecordGuestCheckoutCompletion
  | RecordGuestCheckoutFailure;

export const GroupCheckoutFacade = (options: { eventStore: EventStore }) => {
  const { eventStore } = options;

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const event: GroupCheckoutInitiated = {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId: command.data.groupCheckoutId,
          clerkId: command.data.clerkId,
          guestStayAccountIds: command.data.guestStayIds,
          initiatedAt: command.data.now,
        },
      };
      eventStore.appendToStream(command.data.groupCheckoutId, [event]);
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = eventStore.aggregateStream(
        command.data.groupCheckoutId,
        undefined!, // pass proper evolve and initial state
      );

      if (!groupCheckout) {
        throw new Error('Entity not found');
      }

      // TODO: Fill the business logic implementation calling your entity/aggregate
      // e.g. account.doSomething;
      const events: GroupCheckoutEvent[] = []; // fill your events

      eventStore.appendToStream(command.data.guestStayAccountId, events);
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = eventStore.aggregateStream(
        command.data.groupCheckoutId,
        undefined!, // pass proper evolve and initial state
      );

      if (!groupCheckout) {
        throw new Error('Entity not found');
      }

      // TODO: Fill the business logic implementation calling your entity/aggregate
      // e.g. account.doSomething;
      const events: GroupCheckoutEvent[] = []; // fill your events

      eventStore.appendToStream(command.data.guestStayAccountId, events);
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
