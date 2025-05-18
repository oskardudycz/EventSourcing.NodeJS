import { faker } from '@faker-js/faker';
import { v4 as uuid } from 'uuid';
import {
  getCommandBus,
  getDatabase,
  getEventBus,
  getMessageCatcher,
  type CommandBus,
  type Database,
  type EventBus,
  type MessageCatcher,
} from '../../tools';
import {
  configureGroupCheckouts,
  GroupCheckoutFacade,
  type InitiateGroupCheckout,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  GuestStayAccountFacade,
} from './guestStayAccounts';

describe('Business Process Tests', () => {
  let database: Database;
  let eventBus: EventBus;
  let commandBus: CommandBus;
  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    database = getDatabase();
    eventBus = getEventBus();
    commandBus = getCommandBus();
    publishedMessages = getMessageCatcher();
    now = new Date();

    eventBus.use(publishedMessages.catchMessage);
    commandBus.use(publishedMessages.catchMessage);

    groupCheckoutFacade = configureGroupCheckouts({
      eventBus,
      commandBus,
      database,
    }).groupCheckoutFacade;
    guestStayFacade = configureGuestStayAccounts({
      commandBus,
      eventBus,
      database,
    }).guestStayAccountFacade;
  });

  it('group checkout for multiple guest stay without payments and charges should complete', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];

    for (const guestStay of guestStays) {
      guestStayFacade.checkInGuest({
        type: 'CheckInGuest',
        data: {
          guestStayAccountId: guestStay.guestStayAccountId,
          guestId: guestStay.guestId,
          roomId: guestStay.roomId,
          now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      });
    }
    publishedMessages.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStays.map((s) => s.guestStayAccountId),
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStays,
          initiatedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStays,
          completedAt: now,
        },
      },
    ]);
  });

  it('group checkout for multiple guest stay with all stays settled should complete', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];
    const amounts = [
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ];

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        guestId: guestStays[0]!.guestId,
        roomId: guestStays[0]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        guestId: guestStays[1]!.guestId,
        roomId: guestStays[1]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        guestId: guestStays[2]!.guestId,
        roomId: guestStays[2]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[2]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[2]! / 2,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[2]! / 2,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStays.map((s) => s.guestStayAccountId),
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStays,
          initiatedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: guestStays,
          completedAt: now,
        },
      },
    ]);
  });

  it('group checkout for multiple guest stay with one settled and rest unsettled should fail', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];
    const amounts = [
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ];

    // settled
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        guestId: guestStays[0]!.guestId,
        roomId: guestStays[0]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        guestId: guestStays[1]!.guestId,
        roomId: guestStays[1]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        guestId: guestStays[2]!.guestId,
        roomId: guestStays[2]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[2]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[2]! / 2,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStays.map((s) => s.guestStayAccountId),
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStays,
          initiatedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          checkedOutAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutCompletion',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutCompleted',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          completedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          failedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          failedAt: now,
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [guestStays[0]],
          failedCheckouts: [guestStays[1], guestStays[2]],
          failedAt: now,
        },
      },
    ]);
  });

  it('group checkout for multiple guest stay with all unsettled should fail', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];
    const amounts = [
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ];

    // charge without payment
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        guestId: guestStays[0]!.guestId,
        roomId: guestStays[0]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[0]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        guestId: guestStays[1]!.guestId,
        roomId: guestStays[1]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[1]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        guestId: guestStays[2]!.guestId,
        roomId: guestStays[2]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        chargeId: uuid(),
        amount: amounts[2]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStays[2]!.guestStayAccountId,
        paymentId: uuid(),
        amount: amounts[2]! / 2,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    publishedMessages.reset();

    const groupCheckoutId = uuid();
    const clerkId = uuid();
    const command: InitiateGroupCheckout = {
      type: 'InitiateGroupCheckout',
      data: {
        groupCheckoutId,
        clerkId,
        guestStayIds: guestStays.map((s) => s.guestStayAccountId),
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages([
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: guestStays,
          initiatedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[0]!.guestStayAccountId,
          failedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[1]!.guestStayAccountId,
          failedAt: now,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'RecordGuestCheckoutFailure',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          now,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          groupCheckoutId,
          guestStayAccountId: guestStays[2]!.guestStayAccountId,
          failedAt: now,
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [],
          failedCheckouts: [guestStays[0], guestStays[1], guestStays[2]],
          failedAt: now,
        },
      },
    ]);
  });
});
