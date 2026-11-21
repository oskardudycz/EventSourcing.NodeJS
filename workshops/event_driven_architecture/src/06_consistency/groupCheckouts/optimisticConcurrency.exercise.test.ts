import { v4 as uuid } from 'uuid';
import {
  getBackgroundJobs,
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageCatcher,
  runBackgroundJobsUntilIdle,
  type BackgroundJobs,
} from '../tools';
import {
  GroupCheckoutFacade,
  type GroupCheckoutEvent,
  type InitiateGroupCheckout,
} from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Group Checkout Optimistic Concurrency Tests', () => {
  let backgroundJobs: BackgroundJobs;
  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    backgroundJobs = getBackgroundJobs();
    const database = getDatabase();
    const messageBus = getMessageBus();
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

  it('group checkout initiated concurrently is initiated once', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayAccountIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayAccountIds, now },
    };

    await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        groupCheckoutFacade.initiateGroupCheckout(command),
      ),
    );

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

  it('guest checkout completions recorded concurrently complete group checkout', async () => {
    const guestStayAccountIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const groupCheckoutId = await initiateGroupCheckout(guestStayAccountIds);

    await Promise.all(
      guestStayAccountIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    );

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveMessagesInAnyOrder([
      ...guestStayAccountIds.map<GroupCheckoutEvent>((guestStayAccountId) => ({
        type: 'GuestCheckoutCompletionRecorded',
        data: { groupCheckoutId, guestStayAccountId, completedAt: now },
      })),
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

  it('guest checkout completions and failure recorded concurrently fail group checkout', async () => {
    const guestStayAccountIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const [failedGuestStayAccountId, ...completedGuestStayAccountIds] =
      guestStayAccountIds;
    const groupCheckoutId = await initiateGroupCheckout(guestStayAccountIds);

    await Promise.all([
      groupCheckoutFacade.recordGuestCheckoutFailure({
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId,
          guestStayAccountId: failedGuestStayAccountId!,
          now,
        },
      }),
      ...completedGuestStayAccountIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    ]);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveMessagesInAnyOrder([
      {
        type: 'GuestCheckoutFailureRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: failedGuestStayAccountId!,
          failedAt: now,
        },
      },
      ...completedGuestStayAccountIds.map<GroupCheckoutEvent>(
        (guestStayAccountId) => ({
          type: 'GuestCheckoutCompletionRecorded',
          data: { groupCheckoutId, guestStayAccountId, completedAt: now },
        }),
      ),
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: completedGuestStayAccountIds,
          failedCheckouts: [failedGuestStayAccountId!],
          failedAt: now,
        },
      },
    ]);
  });
});
