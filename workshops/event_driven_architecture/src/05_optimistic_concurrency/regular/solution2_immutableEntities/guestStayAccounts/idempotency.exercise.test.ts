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

  const checkInGuest = async (): Promise<string> => {
    const guestStayAccountId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: { guestStayAccountId, guestId: uuid(), roomId: '1', now },
    });
    publishedMessages.reset();
    return guestStayAccountId;
  };
  it('guest is checked in once for the same guest stay account', async () => {
    const command: CheckInGuest = {
      type: 'CheckInGuest',
      data: { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1', now },
    };
    await guestStayFacade.checkInGuest(command);

    await guestStayFacade.checkInGuest(command);

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

    const command: CheckoutGuest = {
      type: 'CheckoutGuest',
      data: { guestStayAccountId, groupCheckoutId, now },
    };
    await guestStayFacade.checkoutGuest(command);

    await guestStayFacade.checkoutGuest(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: { guestStayAccountId, groupCheckoutId, checkedOutAt: now },
    });
  });
});
