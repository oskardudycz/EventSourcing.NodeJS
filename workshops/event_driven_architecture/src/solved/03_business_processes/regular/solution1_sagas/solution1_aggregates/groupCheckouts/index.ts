import type { Database, MessageBus } from '../../../../tools';
import type {
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import type {
  RecordGuestCheckoutCompletion,
  RecordGuestCheckoutFailure,
} from './groupCheckoutFacade';
import type { GroupCheckoutInitiated } from './groupCheckout';
import { GroupCheckoutFacade } from './groupCheckoutFacade';
import { GroupCheckoutSaga } from './groupCheckoutSaga';

export * from './groupCheckoutFacade';
export * from './groupCheckout';

export const configureGroupCheckouts = ({
  database,
  messageBus,
}: {
  database: Database;
  messageBus: MessageBus;
}): { groupCheckoutFacade: GroupCheckoutFacade } => {
  const groupCheckoutFacade: GroupCheckoutFacade = GroupCheckoutFacade({
    database,
    messageBus,
  });

  const groupCheckoutSaga = GroupCheckoutSaga({ messageBus });

  messageBus.subscribe<GroupCheckoutInitiated>(
    'GroupCheckoutInitiated',
    groupCheckoutSaga.onGroupCheckoutInitiated,
  );
  messageBus.subscribe<GuestCheckedOut>(
    'GuestCheckedOut',
    groupCheckoutSaga.onGuestCheckedOut,
  );
  messageBus.subscribe<GuestCheckoutFailed>(
    'GuestCheckoutFailed',
    groupCheckoutSaga.onGuestCheckoutFailed,
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
