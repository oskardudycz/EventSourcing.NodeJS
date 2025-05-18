import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getEventBus,
  getEventCatcher,
  type Database,
  type EventBus,
  type EventCatcher,
} from '../tools';
import {
  GuestStayFacade,
  type CheckInGuest,
  type CheckoutGuest,
  type InitiateGroupCheckout,
  type RecordCharge,
  type RecordPayment,
} from './guestStayFacade';

describe('Entity Definition Tests', () => {
  let database: Database;
  let eventBus: EventBus;
  let publishedEvents: EventCatcher;
  let guestStayFacade: ReturnType<typeof GuestStayFacade>;
  let faker: {
    number: () => {
      randomDouble: (precision: number, min: number, max: number) => number;
    };
  };
  let now: Date;

  beforeEach(() => {
    database = getDatabase();
    eventBus = getEventBus();
    publishedEvents = getEventCatcher();
    guestStayFacade = GuestStayFacade({ database, eventBus });
    faker = {
      number: () => ({
        randomDouble: (precision: number, min: number, max: number) =>
          Math.floor(Math.random() * (max - min + 1)) + min,
      }),
    };
    now = new Date();
    eventBus.use(publishedEvents.catchMessage);
  });

  it('checking in guest succeeds', () => {
    const guestStayId = uuid();
    const command: CheckInGuest = {
      type: 'CheckInGuest',
      data: {
        guestStayId,
        guestId: uuid(),
        roomId: 'room-123',
        now,
      },
    };
    publishedEvents.reset();

    guestStayFacade.checkInGuest(command);

    publishedEvents.shouldReceiveSingleEvent({
      type: 'GuestCheckedIn',
      data: {
        guestStayAccountId: guestStayId,
        guestId: command.data.guestId,
        roomId: command.data.roomId,
        checkedInAt: now,
      },
    });
  });

  it('recording charge for checked in guest succeeds', () => {
    const guestStayId = uuid();
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const amount = faker.number().randomDouble(2, 10, 1000);
    const command: RecordCharge = {
      type: 'RecordCharge',
      data: {
        guestStayId,
        amount,
        now,
      },
    };

    guestStayFacade.recordCharge(command);

    publishedEvents.shouldReceiveSingleEvent({
      type: 'ChargeRecorded',
      data: {
        guestStayAccountId: guestStayId,
        chargeId: expect.any(String),
        amount,
        recordedAt: now,
      },
    });
  });

  it('recording payment for checked in guest succeeds', () => {
    const guestStayId = uuid();
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const amount = faker.number().randomDouble(2, 10, 1000);
    const command: RecordPayment = {
      type: 'RecordPayment',
      data: {
        guestStayId,
        amount,
        now,
      },
    };

    guestStayFacade.recordPayment(command);

    publishedEvents.shouldReceiveSingleEvent({
      type: 'PaymentRecorded',
      data: {
        guestStayAccountId: guestStayId,
        paymentId: expect.any(String),
        amount,
        recordedAt: now,
      },
    });
  });

  it('recording payment for checked in guest with charge succeeds', () => {
    const guestStayId = uuid();
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayId,
        amount: faker.number().randomDouble(2, 10, 1000),
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const amount = faker.number().randomDouble(2, 10, 1000);
    const command: RecordPayment = {
      type: 'RecordPayment',
      data: {
        guestStayId,
        amount,
        now,
      },
    };

    guestStayFacade.recordPayment(command);

    publishedEvents.shouldReceiveSingleEvent({
      type: 'PaymentRecorded',
      data: {
        guestStayAccountId: guestStayId,
        paymentId: expect.any(String),
        amount,
        recordedAt: now,
      },
    });
  });

  it('checking out guest with settled balance succeeds', () => {
    const guestStayId = uuid();
    const amount = faker.number().randomDouble(2, 10, 1000);

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayId,
        amount,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayId,
        amount,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayId,
        now,
      },
    };

    guestStayFacade.checkOutGuest(command);

    publishedEvents.shouldReceiveSingleEvent({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: guestStayId,
        checkedOutAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('checking out guest with unsettled balance fails with guest checkout failed', () => {
    const guestStayId = uuid();
    const amount = faker.number().randomDouble(2, 10, 1000);

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayId,
        amount: amount + 10,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayId,
        amount,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayId,
        now,
      },
    };

    try {
      guestStayFacade.checkOutGuest(command);
    } catch (exc) {
      console.log((exc as Error).message);
    }

    publishedEvents.shouldReceiveSingleEvent({
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: guestStayId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('group checkout for multiple guest stay should be initiated', () => {
    const guestStays = [uuid(), uuid(), uuid()];

    for (const guestStayId of guestStays) {
      guestStayFacade.checkInGuest({
        type: 'CheckInGuest',
        data: {
          guestStayId,
          guestId: uuid(),
          roomId: 'room-123',
          now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      });
    }
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

    guestStayFacade.initiateGroupCheckout(command);

    publishedEvents.shouldReceiveSingleEvent({
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
