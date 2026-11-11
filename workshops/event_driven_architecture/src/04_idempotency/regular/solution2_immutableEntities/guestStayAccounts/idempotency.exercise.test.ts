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
  type CheckoutGuest,
  type RecordCharge,
  type RecordPayment,
} from '.';

describe('Guest Stay Account Idempotency Tests', () => {
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

  const checkInGuest = (): string => {
    const guestStayAccountId = uuid();
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: { guestStayAccountId, guestId: uuid(), roomId: '1', now },
    });
    publishedMessages.reset();
    return guestStayAccountId;
  };
  it('guest is checked in once for the same guest stay account', () => {
    const command: CheckInGuest = {
      type: 'CheckInGuest',
      data: { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1', now },
    };
    guestStayFacade.checkInGuest(command);

    guestStayFacade.checkInGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedIn',
      data: {
        guestStayAccountId: command.data.guestStayAccountId,
        guestId: command.data.guestId,
        roomId: command.data.roomId,
        checkedInAt: now,
      },
    });
  });

  it('charge is recorded once for the same charge id', () => {
    const guestStayAccountId = checkInGuest();

    const command: RecordCharge = {
      type: 'RecordCharge',
      data: { guestStayAccountId, chargeId: uuid(), amount: 100, now },
    };
    guestStayFacade.recordCharge(command);

    guestStayFacade.recordCharge(command);

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

  it('payment is recorded once for the same payment id', () => {
    const guestStayAccountId = checkInGuest();

    const command: RecordPayment = {
      type: 'RecordPayment',
      data: { guestStayAccountId, paymentId: uuid(), amount: 100, now },
    };
    guestStayFacade.recordPayment(command);

    guestStayFacade.recordPayment(command);

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

  it('guest is checked out once for the same group checkout', () => {
    const guestStayAccountId = checkInGuest();
    const groupCheckoutId = uuid();

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: { guestStayAccountId, groupCheckoutId, now },
    };
    guestStayFacade.checkoutGuest(command);

    guestStayFacade.checkoutGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, groupCheckoutId, checkedOutAt: now },
    });
  });
});
