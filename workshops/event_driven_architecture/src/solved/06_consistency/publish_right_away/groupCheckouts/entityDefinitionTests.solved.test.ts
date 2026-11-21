import { v4 as uuid } from 'uuid';
import {
  getBackgroundJobs,
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type MessageBus,
  type MessageCatcher,
  runBackgroundJobsUntilIdle,
  type BackgroundJobs,
} from '../tools';
import { GroupCheckoutFacade, type InitiateGroupCheckout } from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Group Checkout Entity Definition Tests', () => {
  let backgroundJobs: BackgroundJobs;
  let database: Database;
  let messageBus: MessageBus;
  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    backgroundJobs = getBackgroundJobs();
    database = getDatabase();
    messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    groupCheckoutFacade = GroupCheckoutFacade({
      database,
      messageBus,
      backgroundJobs,
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
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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

  it('recording guest checkout completion succeeds', async () => {
    const guestStayAccountId = uuid();
    const groupCheckoutId = await initiateGroupCheckout([
      guestStayAccountId,
      uuid(),
      uuid(),
    ]);

    await groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId, now },
    });

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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

    await groupCheckoutFacade.recordGuestCheckoutFailure({
      type: 'RecordGuestCheckoutFailure',
      data: { groupCheckoutId, guestStayAccountId, now },
    });

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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
    await groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId,
        guestStayAccountId: completedGuestStayAccountId,
        now,
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    await groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId,
        guestStayAccountId: lastGuestStayAccountId,
        now,
      },
    });

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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
    await groupCheckoutFacade.recordGuestCheckoutFailure({
      type: 'RecordGuestCheckoutFailure',
      data: {
        groupCheckoutId,
        guestStayAccountId: failedGuestStayAccountId,
        now,
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    await groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: {
        groupCheckoutId,
        guestStayAccountId: lastGuestStayAccountId,
        now,
      },
    });

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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
