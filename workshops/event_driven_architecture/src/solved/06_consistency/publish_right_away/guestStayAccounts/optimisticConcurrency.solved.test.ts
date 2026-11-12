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
import { GuestStayAccountFacade } from '.';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Guest Stay Account Optimistic Concurrency Tests', () => {
  let backgroundJobs: BackgroundJobs;
  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let now: Date;

  beforeEach(() => {
    backgroundJobs = getBackgroundJobs();
    const database = getDatabase();
    const messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    guestStayFacade = GuestStayAccountFacade({
      database,
      messageBus,
      backgroundJobs,
    });
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);
  });

  const checkInGuest = async () => {
    const guestStayAccountId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: { guestStayAccountId, guestId: uuid(), roomId: 'O-1', now },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedMessages);
    publishedMessages.reset();

    return guestStayAccountId;
  };

  it('charges recorded concurrently all count towards balance', async () => {
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

  it('charge recorded concurrently with checkout does not let guest check out with unsettled balance', async () => {
    const guestStayAccountId = await checkInGuest();

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
    const publishedTypes = publishedMessages.published
      .map(({ type }) => type)
      .sort();
    const checkedOutBeforeCharge = ['GuestCheckedOut'];
    const chargedBeforeCheckout = ['ChargeRecorded', 'GuestCheckoutFailed'];

    expect([checkedOutBeforeCharge, chargedBeforeCheckout]).toContainEqual(
      publishedTypes,
    );
  });
});
