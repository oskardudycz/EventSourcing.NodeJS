import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageBus,
  type MessageCatcher,
} from '../../../tools';
import type {
  CheckoutGuest,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import {
  configureGroupCheckouts,
  type GroupCheckoutEvent,
  type GroupCheckoutFacade,
  type InitiateGroupCheckout,
} from '.';

type ExpectedTypes =
  | GroupCheckoutEvent
  | CheckoutGuest
  | GuestCheckedOut
  | GuestCheckoutFailed;

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

  const initiateGroupCheckout = (guestStayIds: string[]) => {
    const groupCheckoutId = uuid();
    groupCheckoutFacade.initiateGroupCheckout({
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

  it('initiating group checkout succeeds', () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStayIds,
          initiatedAt: now,
        },
      },
      ...guestStayIds.map(
        (guestStayAccountId): CheckoutGuest => ({
          type: 'CheckoutGuest',
          data: { guestStayAccountId, now, groupCheckoutId },
        }),
      ),
    ]);
  });

  it('recording guest checkout completion succeeds', () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);
    const event: GuestCheckedOut = {
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, checkedOutAt: now, groupCheckoutId },
    };

    messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([event]);
  });

  it('recording guest checkout failure succeeds', () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
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

    messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([event]);
  });

  it('recording last guest checkout completion completes group checkout', () => {
    const completedGuestStayId = uuid();
    const lastGuestStayId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      completedGuestStayId,
      lastGuestStayId,
    ]);
    messageBus.publish<GuestCheckedOut>([
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: completedGuestStayId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
    ]);
    publishedMessages.reset();
    const event: GuestCheckedOut = {
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: lastGuestStayId,
        checkedOutAt: now,
        groupCheckoutId,
      },
    };

    messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
      event,
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

  it('recording last guest checkout after failure fails group checkout', () => {
    const failedGuestStayId = uuid();
    const lastGuestStayId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      failedGuestStayId,
      lastGuestStayId,
    ]);
    messageBus.publish<GuestCheckoutFailed>([
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: failedGuestStayId,
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
        guestStayAccountId: lastGuestStayId,
        checkedOutAt: now,
        groupCheckoutId,
      },
    };

    messageBus.publish([event]);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
      event,
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
