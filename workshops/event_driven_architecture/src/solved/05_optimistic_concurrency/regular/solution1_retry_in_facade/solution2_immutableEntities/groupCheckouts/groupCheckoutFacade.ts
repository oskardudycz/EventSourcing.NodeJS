import {
  retryOnConflict,
  type Database,
  type MessageBus,
} from '../../../../tools';
import {
  initiateGroupCheckout,
  recordGuestCheckout,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from './businessLogic';
import {
  evolve,
  initial,
  type GroupCheckout,
  type GroupCheckoutEvent,
} from './groupCheckout';

export const GroupCheckoutFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const groupCheckouts = database.collection<GroupCheckout>('groupCheckout');

  const handle = async (
    id: string,
    decideEvents: (state: GroupCheckout) => GroupCheckoutEvent[],
  ) => {
    const events = await retryOnConflict(async () => {
      const existing = await groupCheckouts.get(id);
      const state = existing?.document ?? initial;

      const events = decideEvents(state);

      if (events.length === 0) return events;

      await groupCheckouts.store(id, events.reduce(evolve, state), {
        expectedVersion: existing?.version ?? 0,
      });

      return events;
    });

    if (events.length === 0) return;

    await messageBus.publish(events);
  };

  return {
    initiateGroupCheckout: (command: InitiateGroupCheckout) =>
      handle(command.data.groupCheckoutId, (state) =>
        state.status === 'NotExisting' ? [initiateGroupCheckout(command)] : [],
      ),
    recordGuestCheckoutCompletion: (command: RecordGuestCheckoutCompletion) =>
      handle(command.data.groupCheckoutId, (state) =>
        state.status === 'NotExisting'
          ? []
          : recordGuestCheckout(command, state),
      ),
    recordGuestCheckoutFailure: (command: RecordGuestCheckoutFailure) =>
      handle(command.data.groupCheckoutId, (state) =>
        state.status === 'NotExisting'
          ? []
          : recordGuestCheckout(command, state),
      ),
  };
};

export type GroupCheckoutFacade = ReturnType<typeof GroupCheckoutFacade>;
