import type { CommandBus, EventStore } from '../../../tools';
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
  eventStore,
  commandBus,
}: {
  eventStore: EventStore;
  commandBus: CommandBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    eventStore,
    commandBus,
  });

  eventStore.subscribe<GroupCheckoutInitiated>(
    'GroupCheckoutInitiated',
    (event) => commandBus.send(GroupCheckoutSaga(event)),
  );
  eventStore.subscribe<GuestCheckedOut>('GuestCheckedOut', (event) =>
    commandBus.send(GroupCheckoutSaga(event)),
  );
  eventStore.subscribe<GuestCheckoutFailed>('GuestCheckoutFailed', (event) =>
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
