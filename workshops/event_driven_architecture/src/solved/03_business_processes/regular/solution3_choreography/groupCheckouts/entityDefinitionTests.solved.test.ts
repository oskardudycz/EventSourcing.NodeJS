import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type MessageBus,
  type MessageCatcher,
} from '../../../tools';
import type { CheckOutGuest } from '../guestStayAccounts';
import { GroupCheckoutFacade, type InitiateGroupCheckout } from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Group Checkout Entity Definition Tests', () => {
  let database: Database;
  let messageBus: MessageBus;
  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    database = getDatabase();
    messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    groupCheckoutFacade = GroupCheckoutFacade({
      database,
      messageBus,
    });
    now = new Date();
    messageBus.use(publishedMessages.catchMessage);
  });

  const initiateGroupCheckout = async (guestStayAccountIds: string[]) => {
    const groupCheckoutId = uuid();
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId: uuid(),
        guestStayAccountIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    return groupCheckoutId;
  };

  it('initiating group checkout succeeds', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayAccountIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayAccountIds, now },
    };

    await groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStayAccountIds,
          initiatedAt: now,
        },
      },
      ...guestStayAccountIds.map((guestStayAccountId): CheckOutGuest => ({
        type: 'CheckOutGuest',
        data: { guestStayAccountId, now, groupCheckoutId },
      })),
    ]);
  });

  it('recording guest checkout completion succeeds', async () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);

    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, completedAt: now, groupCheckoutId },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutCompletionRecorded',
      data: { groupCheckoutId, guestStayAccountId, completedAt: now },
    });
  });

  it('recording guest checkout failure succeeds', async () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);

    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId,
      },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailureRecorded',
      data: { groupCheckoutId, guestStayAccountId, failedAt: now },
    });
  });

  it('recording last guest checkout completion completes group checkout', async () => {
    const completedGuestStayAccountId = uuid();
    const lastGuestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      completedGuestStayAccountId,
      lastGuestStayAccountId,
    ]);
    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: completedGuestStayAccountId,
        completedAt: now,
        groupCheckoutId,
      },
    });
    publishedMessages.reset();

    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayAccountId,
        completedAt: now,
        groupCheckoutId,
      },
    });

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: lastGuestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: [
            completedGuestStayAccountId,
            lastGuestStayAccountId,
          ],
          completedAt: now,
        },
      },
    ]);
  });

  it('recording last guest checkout after failure fails group checkout', async () => {
    const failedGuestStayAccountId = uuid();
    const lastGuestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      failedGuestStayAccountId,
      lastGuestStayAccountId,
    ]);
    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: failedGuestStayAccountId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId,
      },
    });
    publishedMessages.reset();

    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayAccountId,
        completedAt: now,
        groupCheckoutId,
      },
    });

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: lastGuestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [lastGuestStayAccountId],
          failedCheckouts: [failedGuestStayAccountId],
          failedAt: now,
        },
      },
    ]);
  });
});
