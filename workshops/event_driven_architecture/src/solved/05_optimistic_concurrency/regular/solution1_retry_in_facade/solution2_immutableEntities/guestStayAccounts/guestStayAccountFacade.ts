import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type GuestStayAccount,
  type GuestStayAccountEvent,
  type RecordCharge,
  type RecordPayment,
} from '.';
import {
  retryOnConflict,
  type Database,
  type MessageBus,
} from '../../../../tools';

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
}) => {
  const { database, messageBus } = options;

  const accounts = database.collection<GuestStayAccount>('guestStayAccount');

  const handle = async (
    id: string,
    decideEvents: (state: GuestStayAccount) => GuestStayAccountEvent[],
  ) => {
    const events = await retryOnConflict(async () => {
      const existing = await accounts.get(id);
      const state = existing?.document ?? initial;

      const events = decideEvents(state);

      if (events.length === 0) return events;

      await accounts.store(id, events.reduce(evolve, state), {
        expectedVersion: existing?.version ?? 0,
      });

      return events;
    });

    if (events.length === 0) return;

    await messageBus.publish(events);
  };

  return {
    checkInGuest: (command: CheckInGuest) =>
      handle(command.data.guestStayAccountId, (state) =>
        decide(command, state),
      ),
    recordCharge: (command: RecordCharge) =>
      handle(command.data.guestStayAccountId, (state) => {
        if (state.status === 'NotExisting') throw new Error('Entity not found');

        return decide(command, state);
      }),
    recordPayment: (command: RecordPayment) =>
      handle(command.data.guestStayAccountId, (state) => {
        if (state.status === 'NotExisting') throw new Error('Entity not found');

        return decide(command, state);
      }),
    checkoutGuest: (command: CheckoutGuest) =>
      handle(command.data.guestStayAccountId, (state) =>
        state.status === 'NotExisting' ? [] : decide(command, state),
      ),
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
