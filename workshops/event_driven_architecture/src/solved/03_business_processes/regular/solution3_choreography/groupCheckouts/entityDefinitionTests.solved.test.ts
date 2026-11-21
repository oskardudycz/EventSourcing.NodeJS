import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type MessageBus,
  type MessageCatcher,
} from '../../../tools';
import type { CheckoutGuest } from '../guestStayAccounts';
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

  const initiateGroupCheckout = async (guestStayIds: string[]) => {
    const groupCheckoutId = uuid();
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId: uuid(),
        guestStayIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    return groupCheckoutId;
  };

  it('initiating group checkout succeeds', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
    };

    await groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStayIds,
          initiatedAt: now,
        },
      },
      ...guestStayIds.map((guestStayAccountId): CheckoutGuest => ({
        type: 'CheckoutGuest',
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
      data: { guestStayAccountId, checkedOutAt: now, groupCheckoutId },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutCompletionRecorded',
      data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
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
    const completedGuestStayId = uuid();
    const lastGuestStayId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      completedGuestStayId,
      lastGuestStayId,
    ]);
    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: completedGuestStayId,
        checkedOutAt: now,
        groupCheckoutId,
      },
    });
    publishedMessages.reset();

    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayId,
        checkedOutAt: now,
        groupCheckoutId,
      },
    });

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: lastGuestStayId,
          checkedOutAt: now,
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: [completedGuestStayId, lastGuestStayId],
          completedAt: now,
        },
      },
    ]);
  });

  it('recording last guest checkout after failure fails group checkout', async () => {
    const failedGuestStayId = uuid();
    const lastGuestStayId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      failedGuestStayId,
      lastGuestStayId,
    ]);
    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: failedGuestStayId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId,
      },
    });
    publishedMessages.reset();

    await groupCheckoutFacade.onGuestCheckoutResult({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayId,
        checkedOutAt: now,
        groupCheckoutId,
      },
    });

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: lastGuestStayId,
          checkedOutAt: now,
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [lastGuestStayId],
          failedCheckouts: [failedGuestStayId],
          failedAt: now,
        },
      },
    ]);
  });
});
