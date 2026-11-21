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
  type CheckInGuest,
  type CheckOutGuest,
  type RecordCharge,
  type RecordPayment,
  GuestStayAccountFacade,
} from '.';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Guest Stay Account Entity Definition Tests', () => {
  it('checking in guest succeeds', async () => {
    const guestStayAccountId = uuid();
    const command: CheckInGuest = {
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };
    publishedMessages.reset();

    await guestStayFacade.checkInGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedIn',
      data: {
        guestStayAccountId: guestStayAccountId,
        openedAt: now,
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

    await guestStayFacade.recordCharge(command);

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

  it('recording payment for checked in guest succeeds', async () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
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

    await guestStayFacade.recordPayment(command);

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

  it('recording payment for checked in guest with charge succeeds', async () => {
    const guestStayAccountId = uuid();
    const paymentId = uuid();
    const chargeId = uuid();

    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId,
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

    await guestStayFacade.recordPayment(command);

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
    publishedMessages.reset();

    const command: CheckOutGuest = {
      type: 'CheckOutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    await guestStayFacade.checkOutGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: guestStayAccountId,
        completedAt: now,
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
    publishedMessages.reset();

    const command: CheckOutGuest = {
      type: 'CheckOutGuest',
      data: {
        guestStayAccountId,
        now,
      },
    };

    try {
      await guestStayFacade.checkOutGuest(command);
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

  it('recording a charge for a missing guest stay account fails with Entity not found', async () => {
    const command: RecordCharge = {
      type: 'RecordCharge',
      data: {
        guestStayAccountId: uuid(),
        chargeId: uuid(),
        amount: 100,
        now,
      },
    };

    await expect(guestStayFacade.recordCharge(command)).rejects.toThrow(
      'Entity not found',
    );

    publishedMessages.shouldNotReceiveAnyMessage();
  });

  it('recording a payment for a missing guest stay account fails with Entity not found', async () => {
    const command: RecordPayment = {
      type: 'RecordPayment',
      data: {
        guestStayAccountId: uuid(),
        paymentId: uuid(),
        amount: 100,
        now,
      },
    };

    await expect(guestStayFacade.recordPayment(command)).rejects.toThrow(
      'Entity not found',
    );

    publishedMessages.shouldNotReceiveAnyMessage();
  });

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
});
