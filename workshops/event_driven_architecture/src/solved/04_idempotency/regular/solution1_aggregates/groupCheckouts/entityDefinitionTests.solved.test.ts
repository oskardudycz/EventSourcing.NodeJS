import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type MessageBus,
  type MessageCatcher,
} from '../../../tools';
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

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds: guestStayIds,
        initiatedAt: now,
      },
    });
  });

  it('recording guest checkout completion succeeds', () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);

    groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId, now },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutCompletionRecorded',
      data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
    });
  });

  it('recording guest checkout failure succeeds', () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);

    groupCheckoutFacade.recordGuestCheckoutFailure({
      type: 'RecordGuestCheckoutFailure',
      data: { groupCheckoutId, guestStayAccountId, now },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailureRecorded',
      data: { groupCheckoutId, guestStayAccountId, failedAt: now },
    });
  });

  it('recording last guest checkout completion completes group checkout', () => {
    const completedGuestStayId = uuid();
    const lastGuestStayId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      completedGuestStayId,
      lastGuestStayId,
    ]);
    groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: completedGuestStayId, now },
    });
    publishedMessages.reset();

    groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: lastGuestStayId, now },
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

  it('recording last guest checkout after failure fails group checkout', () => {
    const failedGuestStayId = uuid();
    const lastGuestStayId = uuid();
    const groupCheckoutId = initiateGroupCheckout([
      failedGuestStayId,
      lastGuestStayId,
    ]);
    groupCheckoutFacade.recordGuestCheckoutFailure({
      type: 'RecordGuestCheckoutFailure',
      data: { groupCheckoutId, guestStayAccountId: failedGuestStayId, now },
    });
    publishedMessages.reset();

    groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: lastGuestStayId, now },
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
