import { v4 as uuid } from 'uuid';
import {
  getBackgroundJobs,
  getCommandBus,
  getDatabase,
  getEventBus,
  getMessageCatcher,
  type EventBus,
  type MessageCatcher,
  runBackgroundJobsUntilIdle,
  type BackgroundJobs,
} from './tools';
import {
  GroupCheckoutFacade,
  type GroupCheckoutEvent,
  type InitiateGroupCheckout,
} from './groupCheckouts';
import { GuestStayAccountFacade } from './guestStayAccounts';

describe('Optimistic Concurrency Tests', () => {
  let backgroundJobs: BackgroundJobs;
  let eventBus: EventBus;
  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    backgroundJobs = getBackgroundJobs();
    const database = getDatabase();
    eventBus = getEventBus();
    const commandBus = getCommandBus();
    publishedMessages = getMessageCatcher();
    guestStayFacade = GuestStayAccountFacade({
      database,
      eventBus,
      backgroundJobs,
    });
    groupCheckoutFacade = GroupCheckoutFacade({
      database,
      eventBus,
      commandBus,
      backgroundJobs,
    });
    now = new Date();

    eventBus.use(publishedMessages.catchMessage);
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
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    return groupCheckoutId;
  };

  const checkInGuest = async () => {
    const guestStayAccountId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: { guestStayAccountId, guestId: uuid(), roomId: 'O-1', now },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);

    return guestStayAccountId;
  };

  it('group checkout initiated concurrently is initiated once', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
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
        guestStayAccountIds: guestStayIds,
        initiatedAt: now,
      },
    });
  });

  it('group checkout completes when guest checkout completions are recorded concurrently', async () => {
    const guestStayIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const groupCheckoutId = await initiateGroupCheckout(guestStayIds);

    await Promise.all(
      guestStayIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    );

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveMessagesInAnyOrder<GroupCheckoutEvent>([
      ...guestStayIds.map<GroupCheckoutEvent>((guestStayAccountId) => ({
        type: 'GuestCheckoutCompletionRecorded',
        data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
      })),
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStayIds,
          completedAt: now,
        },
      },
    ]);
  });

  it('group checkout fails when guest checkout completions and failure are recorded concurrently', async () => {
    const guestStayIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const [failedGuestStayId, ...completedGuestStayIds] = guestStayIds;
    const groupCheckoutId = await initiateGroupCheckout(guestStayIds);

    await Promise.all([
      groupCheckoutFacade.recordGuestCheckoutFailure({
        type: 'RecordGuestCheckoutFailure',
        data: { groupCheckoutId, guestStayAccountId: failedGuestStayId!, now },
      }),
      ...completedGuestStayIds.map((guestStayAccountId) =>
        groupCheckoutFacade.recordGuestCheckoutCompletion({
          type: 'RecordGuestCheckoutCompletion',
          data: { groupCheckoutId, guestStayAccountId, now },
        }),
      ),
    ]);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveMessagesInAnyOrder<GroupCheckoutEvent>([
      {
        type: 'GuestCheckoutFailureRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: failedGuestStayId!,
          failedAt: now,
        },
      },
      ...completedGuestStayIds.map<GroupCheckoutEvent>(
        (guestStayAccountId) => ({
          type: 'GuestCheckoutCompletionRecorded',
          data: { groupCheckoutId, guestStayAccountId, checkedOutAt: now },
        }),
      ),
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: completedGuestStayIds,
          failedCheckouts: [failedGuestStayId!],
          failedAt: now,
        },
      },
    ]);
  });

  it('charges recorded concurrently all count towards the balance', async () => {
    const guestStayAccountId = await checkInGuest();
    const amounts = [10, 20, 30, 40, 50];

    await Promise.all(
      amounts.map((amount) =>
        guestStayFacade.recordCharge({
          type: 'RecordCharge',
          data: { guestStayAccountId, chargeId: uuid(), amount, now },
        }),
      ),
    );
    await guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId: uuid(),
        amount: amounts.reduce((sum, amount) => sum + amount, 0),
        now,
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    await guestStayFacade.checkoutGuest({
      type: 'CheckoutGuest',
      data: { guestStayAccountId, now },
    });

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId,
        checkedOutAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('guest does not check out with unsettled balance when charge is recorded concurrently', async () => {
    const guestStayAccountId = await checkInGuest();
    const publishedEventTypes: string[] = [];
    eventBus.use((event) => publishedEventTypes.push(event.type));

    await Promise.allSettled([
      guestStayFacade.checkoutGuest({
        type: 'CheckoutGuest',
        data: { guestStayAccountId, now },
      }),
      guestStayFacade.recordCharge({
        type: 'RecordCharge',
        data: { guestStayAccountId, chargeId: uuid(), amount: 100, now },
      }),
    ]);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    const checkedOutBeforeCharge = ['GuestCheckedOut'];
    const chargedBeforeCheckout = ['ChargeRecorded', 'GuestCheckoutFailed'];

    expect([checkedOutBeforeCharge, chargedBeforeCheckout]).toContainEqual(
      publishedEventTypes.sort(),
    );
  });
});
