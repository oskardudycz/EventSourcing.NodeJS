import type { Database, Message, MessageBus } from '../../../tools';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
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
    initiateGroupCheckout: (_command: InitiateGroupCheckout) =>
      Promise.reject(
        new Error(
          'TODO: Fill the implementation calling your entity/aggregate',
        ),
      ),
    recordGuestCheckoutCompletion: async (
      command: RecordGuestCheckoutCompletion,
    ) => {
      const groupCheckout = await groupCheckouts.get(
        command.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      // TODO: do something with grup checkout and produce messages
      const messages: Message[] = [];

      await groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);
      await messageBus.publish(messages);

      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const groupCheckout = await groupCheckouts.get(
        command.data.groupCheckoutId,
      );

      if (!groupCheckout) {
        return;
      }

      // TODO: do something with grup checkout and produce messages
      const messages: Message[] = [];

      await groupCheckouts.store(command.data.groupCheckoutId, groupCheckout);
      await messageBus.publish(messages);

      throw new Error(
        'TODO: Fill the implementation calling your entity/aggregate',
      );
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
