import { faker } from '@faker-js/faker';
import { v4 as uuid } from 'uuid';
import {
  getBackgroundJobs,
  getCommandBus,
  getDatabase,
  getEventBus,
  getMessageCatcher,
  type CommandBus,
  type Database,
  type EventBus,
  type MessageCatcher,
  runBackgroundJobsUntilIdle,
  type BackgroundJobs,
} from './tools';
import {
  GroupCheckoutFacade,
  type InitiateGroupCheckout,
} from './groupCheckouts';
import type {
  CheckInGuest,
  CheckoutGuest,
  RecordCharge,
  RecordPayment,
} from './guestStayAccounts';
import { GuestStayAccountFacade } from './guestStayAccounts';

describe('Entity Definition Tests', () => {
  let backgroundJobs: BackgroundJobs;
  let database: Database;
  let eventBus: EventBus;
  let commandBus: CommandBus;
  let publishedEvents: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    backgroundJobs = getBackgroundJobs();
    database = getDatabase();
    eventBus = getEventBus();
    commandBus = getCommandBus();
    publishedEvents = getMessageCatcher();
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
    eventBus.use(publishedEvents.catchMessage);
  });

  it('checking in guest succeeds', async () => {
    const guestStayAccountId = uuid();
    const command: CheckInGuest = {
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now,
      },
    };
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    await guestStayFacade.checkInGuest(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'GuestCheckedIn',
      data: {
        guestStayAccountId: guestStayAccountId,
        guestId: command.data.guestId,
        roomId: command.data.roomId,
        checkedInAt: now,
      },
    });
  });

  it('recording charge for checked in guest succeeds', async () => {
    const guestStayAccountId = uuid();
    const chargeId = uuid();

    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });
    const command: RecordCharge = {
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId,
        amount,
        now,
      },
    };

    await guestStayFacade.recordCharge(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'ChargeRecorded',
      data: {
        guestStayAccountId: guestStayAccountId,
        chargeId,
        amount,
        recordedAt: now,
      },
    });
  });

  it('recording payment for checked in guest succeeds', async () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });
    const command: RecordPayment = {
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId,
        amount,
        now,
      },
    };

    await guestStayFacade.recordPayment(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'PaymentRecorded',
      data: {
        guestStayAccountId: guestStayAccountId,
        paymentId,
        amount,
        recordedAt: now,
      },
    });
  });

  it('recording payment for checked in guest with charge succeeds', async () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();

    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId,
        amount: faker.number.float({
          min: 2,
          max: 10,
          fractionDigits: 2,
        }),
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });
    const command: RecordPayment = {
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId,
        amount,
        now,
      },
    };

    await guestStayFacade.recordPayment(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'PaymentRecorded',
      data: {
        guestStayAccountId: guestStayAccountId,
        paymentId,
        amount,
        recordedAt: now,
      },
    });
  });

  it('checking out guest with settled balance succeeds', async () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();
    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });

    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId,
        amount,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    await guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId,
        amount,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    await guestStayFacade.checkoutGuest(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: guestStayAccountId,
        checkedOutAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('checking out guest with unsettled balance fails with guest checkout failed', async () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();
    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });

    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    await guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId,
        amount: amount + 10,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    await guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId,
        amount,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    try {
      await guestStayFacade.checkoutGuest(command);
    } catch (exc) {
      console.log((exc as Error).message);
    }

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: guestStayAccountId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('group checkout for multiple guest stay should be initiated', async () => {
    const guestStays = [uuid(), uuid(), uuid()];

    for (const guestStayAccountId of guestStays) {
      await guestStayFacade.checkInGuest({
        type: 'CheckInGuest',
        data: {
          guestStayAccountId,
          guestId: uuid(),
          roomId: 'room-123',
          now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      });
    }
    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStays,
        now,
      },
    };

    await groupCheckoutFacade.initiateGroupCheckout(command);

    await runBackgroundJobsUntilIdle(backgroundJobs, publishedEvents);
    publishedEvents.shouldReceiveSingleMessage({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayAccountIds: guestStays,
        initiatedAt: now,
      },
    });
  });
});
