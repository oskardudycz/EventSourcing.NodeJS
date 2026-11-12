import { faker } from '@faker-js/faker';
import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type MessageBus,
  type MessageCatcher,
} from '../../../tools';
import {
  GuestStayAccountFacade,
  type CheckInGuest,
  type CheckoutGuest,
  type RecordCharge,
  type RecordPayment,
} from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Guest Stay Account Entity Definition Tests', () => {
  let database: Database;
  let messageBus: MessageBus;
  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let now: Date;

  beforeEach(() => {
    database = getDatabase();
    messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    guestStayFacade = GuestStayAccountFacade({ database, messageBus });
    now = new Date();
    messageBus.use(publishedMessages.catchMessage);
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
    publishedMessages.reset();

    guestStayFacade.checkInGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
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
    publishedMessages.reset();

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

    publishedMessages.shouldReceiveSingleMessage({
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
    publishedMessages.reset();

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

    publishedMessages.shouldReceiveSingleMessage({
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
    publishedMessages.reset();

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

    publishedMessages.shouldReceiveSingleMessage({
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
    publishedMessages.reset();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    guestStayFacade.checkoutGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
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
    publishedMessages.reset();

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

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: guestStayAccountId,
        reason: 'BalanceNotSettled',
        failedAt: now,
        groupCheckoutId: undefined,
      },
    });
  });
});
