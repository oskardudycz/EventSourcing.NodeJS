import { faker } from '@faker-js/faker';
import { v4 as uuid } from 'uuid';
import {
  getEventStore,
  getMessageCatcher,
  type EventStore,
  type MessageCatcher,
} from '../../tools';
import type {
  CheckInGuest,
  CheckoutGuest,
  RecordCharge,
  RecordPayment,
} from './guestStayAccounts';
import { GuestStayFacade, type InitiateGroupCheckout } from './guestStayFacade';

describe('Entity Definition Tests', () => {
  let eventStore: EventStore;
  let publishedEvents: MessageCatcher;
  let guestStayFacade: ReturnType<typeof GuestStayFacade>;
  let now: Date;

  beforeEach(() => {
    eventStore = getEventStore();
    publishedEvents = getMessageCatcher();
    guestStayFacade = GuestStayFacade({ eventStore: eventStore });
    now = new Date();
    eventStore.use(publishedEvents.catchMessage);
  });

  it('checking in guest succeeds', () => {
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
    publishedEvents.reset();

    guestStayFacade.checkInGuest(command);

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

  it('recording charge for checked in guest succeeds', () => {
    const guestStayAccountId = uuid();
    const chargeId = uuid();

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
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

    guestStayFacade.recordCharge(command);

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

  it('recording payment for checked in guest succeeds', () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
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

    guestStayFacade.recordPayment(command);

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

  it('recording payment for checked in guest with charge succeeds', () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
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

    guestStayFacade.recordPayment(command);

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

  it('checking out guest with settled balance succeeds', () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();
    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId,
        amount,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId,
        amount,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    guestStayFacade.checkoutGuest(command);

    publishedEvents.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: guestStayAccountId,
        checkedOutAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('checking out guest with unsettled balance fails with guest checkout failed', () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();
    const amount = faker.number.float({
      min: 10,
      max: 1000,
      fractionDigits: 2,
    });

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        guestId: uuid(),
        roomId: 'room-123',
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId,
        amount: amount + 10,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId,
        amount,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedEvents.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    try {
      guestStayFacade.checkoutGuest(command);
    } catch (exc) {
      console.log((exc as Error).message);
    }

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

  it('group checkout for multiple guest stay should be initiated', () => {
    const guestStays = [uuid(), uuid(), uuid()];

    for (const guestStayAccountId of guestStays) {
      guestStayFacade.checkInGuest({
        type: 'CheckInGuest',
        data: {
          guestStayAccountId,
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
