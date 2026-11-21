import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageCatcher,
} from '../../../../tools';
import {
  GroupCheckoutFacade,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Group Checkout Idempotency Tests', () => {
  it('group checkout is initiated once for the same id', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayAccountIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayAccountIds, now },
    };
    await groupCheckoutFacade.initiateGroupCheckout(command);

    await groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds: guestStayAccountIds,
        initiatedAt: now,
      },
    });
  });

  it('group checkout records once guest checkout completion', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayAccountIds = [uuid(), uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const command: RecordGuestCheckoutCompletion = {
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayAccountIds[0]!,
        now,
      },
    };
    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutCompletionRecorded',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayAccountIds[0]!,
        completedAt: now,
      },
    });
  });

  it('group checkout records once guest checkout failure', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayAccountIds = [uuid(), uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const command: RecordGuestCheckoutFailure = {
      type: 'RecordGuestCheckoutFailure',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayAccountIds[0]!,
        now,
      },
    };
    await groupCheckoutFacade.recordGuestCheckoutFailure(command);

    await groupCheckoutFacade.recordGuestCheckoutFailure(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailureRecorded',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayAccountIds[0]!,
        failedAt: now,
      },
    });
  });

  it('group checkout completes once when the last guest checkout completion is recorded twice', async () => {
    const groupCheckoutId = uuid();
    const guestStayAccountIds = [uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId: uuid(), guestStayAccountIds, now },
    });
    await groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayAccountIds[0]!,
        now,
      },
    });
    publishedMessages.reset();

    const command: RecordGuestCheckoutCompletion = {
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayAccountIds[1]!,
        now,
      },
    };
    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStayAccountIds[1]!,
          completedAt: now,
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStayAccountIds,
          completedAt: now,
        },
      },
    ]);
  });

  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    const database = getDatabase();
    const messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    groupCheckoutFacade = GroupCheckoutFacade({
      database,
      messageBus,
    });
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);
  });
});
