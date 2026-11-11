import { v4 as uuid } from 'uuid';
import {
  getCommandBus,
  getDatabase,
  getEventBus,
  getMessageCatcher,
  type MessageCatcher,
} from '../../tools';
import {
  configureGroupCheckouts,
  GroupCheckoutFacade,
  type GroupCheckoutEvent,
  type InitiateGroupCheckout,
  type RecordGuestCheckoutCompletion,
  type RecordGuestCheckoutFailure,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  GuestStayAccountFacade,
  type CheckInGuest,
  type CheckoutGuest,
  type GuestStayAccountEvent,
  type RecordCharge,
  type RecordPayment,
} from './guestStayAccounts';

describe('Idempotency Tests', () => {
  let publishedMessages: MessageCatcher;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let guestStayFacade: GuestStayAccountFacade;
  let now: Date;

  beforeEach(() => {
    const database = getDatabase();
    const eventBus = getEventBus();
    const commandBus = getCommandBus();
    publishedMessages = getMessageCatcher();
    groupCheckoutFacade = GroupCheckoutFacade({
      database,
      eventBus,
      commandBus,
    });
    guestStayFacade = GuestStayAccountFacade({ database, eventBus });
    now = new Date();

    eventBus.use(publishedMessages.catchMessage);
  });

  it('group checkout is initiated once for the same id', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId, guestStayIds, now },
    };
    await groupCheckoutFacade.initiateGroupCheckout(command);

    await groupCheckoutFacade.initiateGroupCheckout(command);

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

  it('group checkout records once guest checkout completion', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const command: RecordGuestCheckoutCompletion = {
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: guestStayIds[0]!, now },
    };
    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutCompletionRecorded',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayIds[0]!,
        checkedOutAt: now,
      },
    });
  });

  it('group checkout records once guest checkout failure', async () => {
    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const guestStayIds = [uuid(), uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const command: RecordGuestCheckoutFailure = {
      type: 'RecordGuestCheckoutFailure',
      data: { groupCheckoutId, guestStayAccountId: guestStayIds[0]!, now },
    };
    await groupCheckoutFacade.recordGuestCheckoutFailure(command);

    await groupCheckoutFacade.recordGuestCheckoutFailure(command);

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckoutFailureRecorded',
      data: {
        groupCheckoutId,
        guestStayAccountId: guestStayIds[0]!,
        failedAt: now,
      },
    });
  });

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

  it('group checkout completes once when the last guest checkout completion is recorded twice', async () => {
    const groupCheckoutId = uuid();
    const guestStayIds = [uuid(), uuid()];
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: { groupCheckoutId, clerkId: uuid(), guestStayIds, now },
    });
    await groupCheckoutFacade.recordGuestCheckoutCompletion({
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: guestStayIds[0]!, now },
    });
    publishedMessages.reset();

    const command: RecordGuestCheckoutCompletion = {
      type: 'RecordGuestCheckoutCompletion',
      data: { groupCheckoutId, guestStayAccountId: guestStayIds[1]!, now },
    };
    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    await groupCheckoutFacade.recordGuestCheckoutCompletion(command);

    publishedMessages.shouldReceiveMessages<GroupCheckoutEvent>([
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStayIds[1]!,
          checkedOutAt: now,
        },
      },
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

  it('group checkout completes once when buses deliver every message twice', async () => {
    const database = getDatabase();
    const eventBus = getEventBus({ deliverTwice: true });
    const commandBus = getCommandBus({ deliverTwice: true });
    const publishedEvents = getMessageCatcher();
    eventBus.use(publishedEvents.catchMessage);

    const { groupCheckoutFacade } = configureGroupCheckouts({
      database,
      eventBus,
      commandBus,
    });
    const { guestStayAccountFacade } = configureGuestStayAccounts({
      database,
      eventBus,
      commandBus,
    });

    const guestStayAccountIds = [uuid(), uuid()];
    for (const guestStayAccountId of guestStayAccountIds) {
      await guestStayAccountFacade.checkInGuest({
        type: 'CheckInGuest',
        data: { guestStayAccountId, guestId: uuid(), roomId: '1', now },
      });
    }
    publishedEvents.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    await groupCheckoutFacade.initiateGroupCheckout({
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStayAccountIds,
        now,
      },
    });

    publishedEvents.shouldReceiveMessages<
      GroupCheckoutEvent | GuestStayAccountEvent
    >([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds,
          initiatedAt: now,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStayAccountIds[0]!,
          checkedOutAt: now,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStayAccountIds[1]!,
          checkedOutAt: now,
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStayAccountIds,
          completedAt: now,
        },
      },
    ]);
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
});
