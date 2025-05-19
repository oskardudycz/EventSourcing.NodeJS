import type { CommandBus, EventStore } from '../../../tools';
import type {
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import { GroupCheckoutFacade } from './groupCheckoutFacade';

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

  eventStore.subscribe<GuestCheckedOut>('GuestCheckedOut', (event) => {
    if (!event.data.groupCheckoutId) return;

    groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId: event.data.groupCheckoutId,
        guestStayAccountId: event.data.guestStayAccountId,
        now: event.data.checkedOutAt,
      },
    });
  });
  eventStore.subscribe<GuestCheckoutFailed>('GuestCheckoutFailed', (event) => {
    if (!event.data.groupCheckoutId) return;

    groupCheckoutFacade.recordGuestCheckoutFailure({
      type: 'RecordGuestCheckoutFailure',
      data: {
        groupCheckoutId: event.data.groupCheckoutId,
        guestStayAccountId: event.data.guestStayAccountId,
        now: event.data.failedAt,
      },
    });
  });

  return { groupCheckoutFacade };
};
