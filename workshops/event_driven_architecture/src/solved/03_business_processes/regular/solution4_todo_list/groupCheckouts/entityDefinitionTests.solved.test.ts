import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageBus,
  type MessageCatcher,
} from '../../../tools';
import type {
  CheckOutGuest,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import {
  configureGroupCheckouts,
  type GroupCheckoutFacade,
  type InitiateGroupCheckout,
} from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Group Checkout Entity Definition Tests', () => {
  let messageBus: MessageBus;
  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    now = new Date();
    messageBus.use(publishedMessages.catchMessage);

    groupCheckoutFacade = configureGroupCheckouts({
      database: getDatabase(),
      messageBus,
    }).groupCheckoutFacade;
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
    const event: GuestCheckedOut = {
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, completedAt: now, groupCheckoutId },
    };

    await messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages([event]);
  });

  it('recording guest checkout failure succeeds', async () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);
    const event: GuestCheckoutFailed = {
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId,
      },
    };

    await messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages([event]);
  });

  it('recording last guest checkout completion completes group checkout', async () => {
    const completedGuestStayAccountId = uuid();
    const lastGuestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      completedGuestStayAccountId,
      lastGuestStayAccountId,
    ]);
    await messageBus.publish<GuestCheckedOut>([
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: completedGuestStayAccountId,
          completedAt: now,
          groupCheckoutId,
        },
      },
    ]);
    publishedMessages.reset();
    const event: GuestCheckedOut = {
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayAccountId,
        completedAt: now,
        groupCheckoutId,
      },
    };

    await messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages([
      event,
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
    await messageBus.publish<GuestCheckoutFailed>([
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: failedGuestStayAccountId,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
    ]);
    publishedMessages.reset();
    const event: GuestCheckedOut = {
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayAccountId,
        completedAt: now,
        groupCheckoutId,
      },
    };

    await messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages([
      event,
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
