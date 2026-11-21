import { GroupCheckout } from '.';
import {
  retryOnConflict,
  type Database,
  type MessageBus,
} from '../../../../tools';

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

  const groupCheckouts = database.collection<GroupCheckout>(
    'groupCheckout',
    GroupCheckout,
  );

  const handle = async (
    id: string,
    run: (groupCheckout: GroupCheckout | null) => GroupCheckout | null,
  ) => {
    const events = await retryOnConflict(async () => {
      const existing = await groupCheckouts.get(id);
      const groupCheckout = run(existing?.document ?? null);

      if (!groupCheckout) return [];

      const events = groupCheckout.dequeueUncommittedEvents();

      if (events.length === 0) return events;

      await groupCheckouts.store(id, groupCheckout, {
        expectedVersion: existing?.version ?? 0,
      });

      return events;
    });

    if (events.length === 0) return;

    await messageBus.publish(events);
  };

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) =>
      handle(command.data.groupCheckoutId, (groupCheckout) =>
        groupCheckout ? null : GroupCheckout.initiate(command.data),
      ),
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) =>
      handle(command.data.groupCheckoutId, (groupCheckout) => {
        groupCheckout?.recordGuestCheckoutCompletion(command.data);

        return groupCheckout;
      }),
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) =>
      handle(command.data.groupCheckoutId, (groupCheckout) => {
        groupCheckout?.recordGuestCheckoutFailure(command.data);

        return groupCheckout;
      }),
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
