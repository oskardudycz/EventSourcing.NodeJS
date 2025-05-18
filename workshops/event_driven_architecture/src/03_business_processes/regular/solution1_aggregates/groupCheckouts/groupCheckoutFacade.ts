import type { CommandBus, Database, EventBus, Message } from '../../../tools';
import type { GroupCheckoutInitiated } from './groupCheckout';

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
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { database, eventBus, commandBus } = options;

  const groupCheckouts = database.collection('groupCheckout');

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
      eventBus.publish([event]);
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      // TODO: do something with grup checkout and produce messages
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const messages: Message[] = [];

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        return;
      }

      // TODO: do something with grup checkout and produce messages
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const messages: Message[] = [];

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
