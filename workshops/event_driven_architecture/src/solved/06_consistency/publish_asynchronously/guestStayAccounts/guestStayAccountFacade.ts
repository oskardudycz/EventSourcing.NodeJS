import {
  decide,
  evolve,
  initial,
  type CheckInGuest,
  type CheckoutGuest,
  type GuestStayAccount,
  type RecordCharge,
  type RecordPayment,
} from '.';
import {
  publishFromOutbox,
  retryOnConflict,
  retryUntilSucceeds,
  storeInOutbox,
  type BackgroundJobs,
  type Database,
  type MessageBus,
} from '../tools';

const outboxName = 'guestStayAccountsOutbox';

export const GuestStayAccountFacade = (options: {
  database: Database;
  messageBus: MessageBus;
  backgroundJobs: BackgroundJobs;
}) => {
  const { database, messageBus, backgroundJobs } = options;

  backgroundJobs.register(() =>
    publishFromOutbox({ database, messageBus, outboxName }),
  );

  const accounts = (database: Database) =>
    database.collection<GuestStayAccount>('guestStayAccount');

  return {
    checkInGuest: (command: CheckInGuest) =>
      retryUntilSucceeds(() =>
        database.transaction(async (transaction) => {
          const events = decide(command, initial);

          await accounts(transaction).store(
            command.data.guestStayAccountId,
            events.reduce(evolve, initial),
            { expectedVersion: 0 },
          );

          await storeInOutbox(transaction, outboxName, events);
        }),
      ),
    recordCharge: (command: RecordCharge) =>
      retryOnConflict(() =>
        retryUntilSucceeds(() =>
          database.transaction(async (transaction) => {
            const existing = await accounts(transaction).get(
              command.data.guestStayAccountId,
            );
            const account = existing?.document ?? initial;

            const events = decide(command, account);

            await accounts(transaction).store(
              command.data.guestStayAccountId,
              events.reduce(evolve, account),
              { expectedVersion: existing?.version ?? 0 },
            );

            await storeInOutbox(transaction, outboxName, events);
          }),
        ),
      ),
    recordPayment: (command: RecordPayment) =>
      retryOnConflict(() =>
        retryUntilSucceeds(() =>
          database.transaction(async (transaction) => {
            const existing = await accounts(transaction).get(
              command.data.guestStayAccountId,
            );
            const account = existing?.document ?? initial;

            const events = decide(command, account);

            await accounts(transaction).store(
              command.data.guestStayAccountId,
              events.reduce(evolve, account),
              { expectedVersion: existing?.version ?? 0 },
            );

            await storeInOutbox(transaction, outboxName, events);
          }),
        ),
      ),
    checkoutGuest: (command: CheckoutGuest) =>
      retryOnConflict(() =>
        retryUntilSucceeds(() =>
          database.transaction(async (transaction) => {
            const existing = await accounts(transaction).get(
              command.data.guestStayAccountId,
            );
            const account = existing?.document ?? initial;

            const events = decide(command, account);

            await accounts(transaction).store(
              command.data.guestStayAccountId,
              events.reduce(evolve, account),
              { expectedVersion: existing?.version ?? 0 },
            );

            await storeInOutbox(transaction, outboxName, events);
          }),
        ),
      ),
  };
};

export type GuestStayAccountFacade = ReturnType<typeof GuestStayAccountFacade>;
