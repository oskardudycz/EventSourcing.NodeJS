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
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from '.';

describe('Group Checkout Idempotency Tests', () => {
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

  it('group checkout is initiated once for the same id', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
    };
    await groupCheckoutFacade.initiateGroupCheckout(command);

    await groupCheckoutFacade.initiateGroupCheckout(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
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

  it('group checkout records once guest checkout completion', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    const command: RecordGuestCheckoutCompletion = {
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: guestStayIds[0]!, now },
    };
    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutCompletionRecorded',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayIds[0]!,
        checkedOutAt: now,
      },
    });
  });

  it('group checkout records once guest checkout failure', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    const command: RecordGuestCheckoutFailure = {
      type: 'RecordGuestCheckoutFailure',
      data: { groupCheckoutId, guestStayAccountId: guestStayIds[0]!, now },
    };
    await groupCheckoutFacade.recordGuestCheckoutFailure(command);

    await groupCheckoutFacade.recordGuestCheckoutFailure(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailureRecorded',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayIds[0]!,
        failedAt: now,
      },
    });
  });
});
