import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageCatcher,
} from '../../../tools';
import {
  GuestStayAccountFacade,
  type CheckInGuest,
  type CheckOutGuest,
  type RecordCharge,
  type RecordPayment,
} from '.';
import { beforeEach, describe, it } from 'vitest';

describe('Guest Stay Account Idempotency Tests', () => {
  it('guest is checked in once for the same guest stay account', async () => {
    const command: CheckInGuest = {
      type: 'CheckInGuest',
      data: { guestStayAccountId: uuid(), now },
    };
    await guestStayFacade.checkInGuest(command);

    await guestStayFacade.checkInGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedIn',
      data: {
        guestStayAccountId: command.data.guestStayAccountId,
        openedAt: now,
      },
    });
  });

  it('charge is recorded once for the same charge id', async () => {
    const guestStayAccountId = await checkInGuest();

    const command: RecordCharge = {
      type: 'RecordCharge',
      data: { guestStayAccountId, chargeId: uuid(), amount: 100, now },
    };
    await guestStayFacade.recordCharge(command);

    await guestStayFacade.recordCharge(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'ChargeRecorded',
      data: {
        guestStayAccountId,
        chargeId: command.data.chargeId,
        amount: 100,
        recordedAt: now,
      },
    });
  });

  it('payment is recorded once for the same payment id', async () => {
    const guestStayAccountId = await checkInGuest();

    const command: RecordPayment = {
      type: 'RecordPayment',
      data: { guestStayAccountId, paymentId: uuid(), amount: 100, now },
    };
    await guestStayFacade.recordPayment(command);

    await guestStayFacade.recordPayment(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'PaymentRecorded',
      data: {
        guestStayAccountId,
        paymentId: command.data.paymentId,
        amount: 100,
        recordedAt: now,
      },
    });
  });

  it('guest is checked out once for the same group checkout', async () => {
    const guestStayAccountId = await checkInGuest();
    const groupCheckoutId = uuid();

    const command: CheckOutGuest = {
      type: 'CheckOutGuest',
      data: { guestStayAccountId, groupCheckoutId, now },
    };
    await guestStayFacade.checkOutGuest(command);

    await guestStayFacade.checkOutGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, groupCheckoutId, completedAt: now },
    });
  });

  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let now: Date;

  beforeEach(() => {
    const database = getDatabase();
    const messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    guestStayFacade = GuestStayAccountFacade({ database, messageBus });
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);
  });

  const checkInGuest = async (): Promise<string> => {
    const guestStayAccountId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: { guestStayAccountId, now },
    });
    publishedMessages.reset();
    return guestStayAccountId;
  };
});
