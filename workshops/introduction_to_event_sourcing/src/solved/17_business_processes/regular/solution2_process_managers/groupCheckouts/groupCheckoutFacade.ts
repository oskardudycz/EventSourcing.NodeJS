import { GroupCheckout, type GroupCheckoutEvent } from '.';
import type { CommandBus, EventStore } from '../../../tools';
import {
  type GuestCheckedOut,
  type GuestCheckoutFailed,
} from '../guestStayAccounts';

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

export const GroupCheckoutFacade = (options: {
  eventStore: EventStore;
  commandBus: CommandBus;
}) => {
  const { eventStore, commandBus } = options;

  const aggregateStreamOptions = {
    evolve: (state: GroupCheckout, event: GroupCheckoutEvent) => {
      state.evolve(event);
      return state;
    },
    initial: GroupCheckout.initial,
  };

  const publishMessages = (
    groupCheckoutId: string,
    groupCheckout: GroupCheckout,
  ) => {
    const messages = groupCheckout.dequeueUncommitedMessages();

    const events = messages
      .filter((message) => message.kind === 'Event')
      .map((m) => m.message);

    const commands = messages
      .filter((message) => message.kind === 'Command')
      .map((m) => m.message);

    eventStore.appendToStream(groupCheckoutId, events);

    commandBus.send(commands);
  };

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) => {
      const groupCheckout = GroupCheckout.initiate(command);

      publishMessages(command.data.groupCheckoutId, groupCheckout);
    },
    onGuestCheckedOut: (event: GuestCheckedOut) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = eventStore.aggregateStream(
        event.data.groupCheckoutId,
        aggregateStreamOptions,
      );

      groupCheckout.onGuestCheckedOut(event);

      publishMessages(event.data.groupCheckoutId, groupCheckout);
    },
    onGuestCheckoutFailed: (event: GuestCheckoutFailed) => {
      if (!event.data.groupCheckoutId) return;

      const groupCheckout = eventStore.aggregateStream(
        event.data.groupCheckoutId,
        aggregateStreamOptions,
      );

      groupCheckout.onGuestCheckoutFailed(event);

      publishMessages(event.data.groupCheckoutId, groupCheckout);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
