import { v4 as uuid } from 'uuid';
import { getDatabase, getMessageBus, getMessageCatcher } from '../../../tools';
import {
  configureGroupCheckouts,
  type GroupCheckoutEvent,
  type RecordGuestCheckoutCompletion,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  type CheckOutGuest,
  type GuestStayAccountEvent,
} from './guestStayAccounts';
import { beforeEach, describe, it } from 'vitest';

describe('Idempotency Tests', () => {
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
        data: { guestStayAccountId, now },
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
        guestStayAccountIds: guestStayAccountIds,
        now,
      },
    });

    const [first, second] = guestStayAccountIds as [string, string];
    const checkOutGuest = (guestStayAccountId: string): CheckOutGuest => ({
      type: 'CheckOutGuest',
      data: { guestStayAccountId, now, groupCheckoutId },
    });
    const guestCheckedOut = (
      guestStayAccountId: string,
    ): GuestStayAccountEvent => ({
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, completedAt: now, groupCheckoutId },
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
      data: { groupCheckoutId, guestStayAccountId, completedAt: now },
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
      checkOutGuest(first),
      guestCheckedOut(first),
      recordGuestCheckoutCompletion(first),
      guestCheckoutCompletionRecorded(first),
      recordGuestCheckoutCompletion(first),
      checkOutGuest(second),
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
      checkOutGuest(first),
      checkOutGuest(second),
    ]);
  });

  let now: Date;

  beforeEach(() => {
    now = new Date();
  });
});
