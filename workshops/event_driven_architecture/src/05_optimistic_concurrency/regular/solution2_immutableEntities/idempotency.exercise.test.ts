import { v4 as uuid } from 'uuid';
import { getDatabase, getMessageBus, getMessageCatcher } from '../../tools';
import {
  configureGroupCheckouts,
  type GroupCheckoutEvent,
  type RecordGuestCheckoutCompletion,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  type CheckoutGuest,
  type GuestStayAccountEvent,
} from './guestStayAccounts';

describe('Idempotency Tests', () => {
  let now: Date;

  beforeEach(() => {
    now = new Date();
  });

  it('group checkout completes once when the bus delivers every message twice', async () => {
    const database = getDatabase();
    const messageBus = getMessageBus({ deliverTwice: true });
    const publishedMessages = getMessageCatcher();
    messageBus.use(publishedMessages.catchMessage);

    const { groupCheckoutFacade } = configureGroupCheckouts({
      database,
      messageBus,
    });
    const { guestStayAccountFacade } = configureGuestStayAccounts({
      database,
      messageBus,
    });

    const guestStayAccountIds = [uuid(), uuid()];
    for (const guestStayAccountId of guestStayAccountIds) {
      await guestStayAccountFacade.checkInGuest({
        type: 'CheckInGuest',
        data: { guestStayAccountId, guestId: uuid(), roomId: '1', now },
      });
    }
    publishedMessages.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStayAccountIds,
        now,
      },
    });

    const [first, second] = guestStayAccountIds as [string, string];
    const checkoutGuest = (guestStayAccountId: string): CheckoutGuest => ({
      type: 'CheckoutGuest',
      data: { guestStayAccountId, now, groupCheckoutId },
    });
    const guestCheckedOut = (
      guestStayAccountId: string,
    ): GuestStayAccountEvent => ({
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, checkedOutAt: now, groupCheckoutId },
    });
    const recordGuestCheckoutCompletion = (
      guestStayAccountId: string,
    ): RecordGuestCheckoutCompletion => ({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId, now },
    });
    const guestCheckoutCompletionRecorded = (
      guestStayAccountId: string,
    ): GroupCheckoutEvent => ({
      type: 'GuestCheckoutCompletionRecorded',
      data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
    });

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds,
          initiatedAt: now,
        },
      },
      checkoutGuest(first),
      guestCheckedOut(first),
      recordGuestCheckoutCompletion(first),
      guestCheckoutCompletionRecorded(first),
      recordGuestCheckoutCompletion(first),
      checkoutGuest(second),
      guestCheckedOut(second),
      recordGuestCheckoutCompletion(second),
      guestCheckoutCompletionRecorded(second),
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStayAccountIds,
          completedAt: now,
        },
      },
      recordGuestCheckoutCompletion(second),
      checkoutGuest(first),
      checkoutGuest(second),
    ]);
  });
});
