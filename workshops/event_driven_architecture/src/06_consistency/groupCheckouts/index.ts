import type { BackgroundJobs, CommandBus, Database, EventBus } from '../tools';
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
  eventBus,
  commandBus,
  backgroundJobs,
}: {
  database: Database;
  eventBus: EventBus;
  commandBus: CommandBus;
  backgroundJobs: BackgroundJobs;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    database,
    eventBus,
    commandBus,
    backgroundJobs,
  });

  eventBus.subscribe<GroupCheckoutInitiated>(
    'GroupCheckoutInitiated',
    (event) => commandBus.send(GroupCheckoutSaga(event)),
  );
  eventBus.subscribe<GuestCheckedOut>('GuestCheckedOut', (event) =>
    commandBus.send(GroupCheckoutSaga(event)),
  );
  eventBus.subscribe<GuestCheckoutFailed>('GuestCheckoutFailed', (event) =>
    commandBus.send(GroupCheckoutSaga(event)),
  );

  commandBus.handle<RecordGuestCheckoutCompletion>(
    'RecordGuestCheckoutCompletion',
    (command) => groupCheckoutFacade.recordGuestCheckoutCompletion(command),
  );
  commandBus.handle<RecordGuestCheckoutFailure>(
    'RecordGuestCheckoutFailure',
    (command) => groupCheckoutFacade.recordGuestCheckoutFailure(command),
  );

  return { groupCheckoutFacade };
};
