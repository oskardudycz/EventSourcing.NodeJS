import {
  retryUntilSucceeds,
  type BackgroundJobs,
  type Database,
  type MessageBus,
} from '../tools';
import type {
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import type {
  RecordGuestCheckoutCompletion,
  RecordGuestCheckoutFailure,
} from './businessLogic';
import { type GroupCheckoutInitiated } from './groupCheckout';
import { GroupCheckoutFacade } from './groupCheckoutFacade';
import { GroupCheckoutSaga } from './groupCheckoutSaga';

export * from './businessLogic';
export * from './groupCheckout';
export * from './groupCheckoutFacade';

export const configureGroupCheckouts = ({
  database,
  messageBus,
  backgroundJobs,
}: {
  database: Database;
  messageBus: MessageBus;
  backgroundJobs: BackgroundJobs;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    database,
    messageBus,
    backgroundJobs,
  });

  messageBus.subscribe<GroupCheckoutInitiated>(
    'GroupCheckoutInitiated',
    (event) =>
      retryUntilSucceeds(() => messageBus.publish(GroupCheckoutSaga(event))),
  );
  messageBus.subscribe<GuestCheckedOut>('GuestCheckedOut', (event) =>
    retryUntilSucceeds(() => messageBus.publish(GroupCheckoutSaga(event))),
  );
  messageBus.subscribe<GuestCheckoutFailed>('GuestCheckoutFailed', (event) =>
    retryUntilSucceeds(() => messageBus.publish(GroupCheckoutSaga(event))),
  );

  messageBus.subscribe<RecordGuestCheckoutCompletion>(
    'RecordGuestCheckoutCompletion',
    (command) => groupCheckoutFacade.recordGuestCheckoutCompletion(command),
  );
  messageBus.subscribe<RecordGuestCheckoutFailure>(
    'RecordGuestCheckoutFailure',
    (command) => groupCheckoutFacade.recordGuestCheckoutFailure(command),
  );

  return { groupCheckoutFacade };
};
