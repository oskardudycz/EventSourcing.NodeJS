import type { Database, Message, MessageBus } from '../../../tools';

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
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const groupCheckouts = database.collection('groupCheckout');

  return {
    initiateGroupCheckout: (_command: InitiateGroupCheckout) => {
      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        throw new Error('Entity not found');
      }

      // TODO: do something with grup checkout and produce messages
      const messages: Message[] = [];

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);
      messageBus.publish(messages);

      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = groupCheckouts.get(command.data.groupCheckoutId);

      if (!groupCheckout) {
        throw new Error('Entity not found');
      }

      // TODO: do something with grup checkout and produce messages
      const messages: Message[] = [];

      groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);
      messageBus.publish(messages);

      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
