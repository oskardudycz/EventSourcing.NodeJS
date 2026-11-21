import { GroupCheckout } from '.';
import type { Database, MessageBus } from '../../../../tools';
import { AggregateStore } from '../../core';

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

  const groupCheckouts = AggregateStore(
    database.collection<GroupCheckout>('groupCheckout', GroupCheckout),
  );

  return {
    initiateGroupCheckout: async (command: InitiateGroupCheckout) => {
      const events = await groupCheckouts.handle(
        command.data.groupCheckoutId,
        (groupCheckout) =>
          groupCheckout ? null : GroupCheckout.initiate(command.data),
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordGuestCheckoutCompletion: async (
      command: RecordGuestCheckoutCompletion,
    ) => {
      const events = await groupCheckouts.handle(
        command.data.groupCheckoutId,
        (groupCheckout) => {
          groupCheckout?.recordGuestCheckoutCompletion(command.data);

          return groupCheckout;
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
    recordGuestCheckoutFailure: async (command: RecordGuestCheckoutFailure) => {
      const events = await groupCheckouts.handle(
        command.data.groupCheckoutId,
        (groupCheckout) => {
          groupCheckout?.recordGuestCheckoutFailure(command.data);

          return groupCheckout;
        },
      );

      if (events.length === 0) return;

      await messageBus.publish(events);
    },
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
