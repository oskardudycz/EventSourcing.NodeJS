import { faker } from '@faker-js/faker';
import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type Database,
  type MessageBus,
  type MessageCatcher,
} from '../../tools';
import {
  configureGroupCheckouts,
  GroupCheckoutFacade,
  type GroupCheckoutCommand,
  type GroupCheckoutEvent,
  type InitiateGroupCheckout,
} from './groupCheckouts';
import {
  configureGuestStayAccounts,
  GuestStayAccountFacade,
  type GuestStayAccountCommand,
  type GuestStayAccountEvent,
} from './guestStayAccounts';

type ExpectedTypes =
  | GroupCheckoutEvent
  | GuestStayAccountEvent
  | GroupCheckoutCommand
  | GuestStayAccountCommand;

describe('Business Process Tests', () => {
  let database: Database;
  let messageBus: MessageBus;
  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let groupCheckoutFacade: GroupCheckoutFacade;
  let now: Date;

  beforeEach(() => {
    database = getDatabase();
    messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);

    groupCheckoutFacade = configureGroupCheckouts({
      messageBus,
      database,
    }).groupCheckoutFacade;
    guestStayFacade = configureGuestStayAccounts({
      messageBus,
      database,
    }).guestStayAccountFacade;
  });

  it('group checkout for multiple guest stay without payments and charges should complete', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];
    const guestStayAccountIds = guestStays.map((s) => s.guestStayAccountId);

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
        guestStayIds: guestStayAccountIds,
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          now,
          groupCheckoutId,
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          now,
          groupCheckoutId,
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          checkedOutAt: now,
          groupCheckoutId,
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

  it('group checkout for multiple guest stay with all stays settled should complete', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];
    const guestStayAccountIds = guestStays.map((s) => s.guestStayAccountId);

    const amounts = [
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ];

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        guestId: guestStays[0]!.guestId,
        roomId: guestStays[0]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        chargeId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        paymentId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        guestId: guestStays[1]!.guestId,
        roomId: guestStays[1]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        paymentId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        chargeId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });

    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        guestId: guestStays[2]!.guestId,
        roomId: guestStays[2]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        chargeId: uuid(),
        amount: amounts[2]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        paymentId: uuid(),
        amount: amounts[2]! / 2,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
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
        guestStayIds: guestStayAccountIds,
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          now,
          groupCheckoutId,
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          now,
          groupCheckoutId,
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          checkedOutAt: now,
          groupCheckoutId,
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

  it('group checkout for multiple guest stay with one settled and rest unsettled should fail', () => {
    const guestStays = [
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '1' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '2' },
      { guestStayAccountId: uuid(), guestId: uuid(), roomId: '3' },
    ];
    const guestStayAccountIds = guestStays.map((s) => s.guestStayAccountId);
    const amounts = [
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ];

    // settled
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        guestId: guestStays[0]!.guestId,
        roomId: guestStays[0]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        chargeId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        paymentId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        guestId: guestStays[1]!.guestId,
        roomId: guestStays[1]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        paymentId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        guestId: guestStays[2]!.guestId,
        roomId: guestStays[2]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        chargeId: uuid(),
        amount: amounts[2]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
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
        guestStayIds: guestStayAccountIds,
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          now,
          groupCheckoutId,
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [guestStayAccountIds[0]!],
          failedCheckouts: [guestStayAccountIds[1]!, guestStayAccountIds[2]!],
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
    const guestStayAccountIds = guestStays.map((s) => s.guestStayAccountId);
    const amounts = [
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
      faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    ];

    // charge without payment
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        guestId: guestStays[0]!.guestId,
        roomId: guestStays[0]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[0]!,
        chargeId: uuid(),
        amount: amounts[0]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        guestId: guestStays[1]!.guestId,
        roomId: guestStays[1]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[1]!,
        paymentId: uuid(),
        amount: amounts[1]!,
        now: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    // payment without charge
    guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        guestId: guestStays[2]!.guestId,
        roomId: guestStays[2]!.roomId,
        now: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
        chargeId: uuid(),
        amount: amounts[2]!,
        now: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    });
    guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId: guestStayAccountIds[2]!,
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
        guestStayIds: guestStayAccountIds,
        now,
      },
    };

    groupCheckoutFacade.initiateGroupCheckout(command);

    publishedMessages.shouldReceiveMessages<ExpectedTypes>([
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
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStayAccountIds[0]!,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStayAccountIds[1]!,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'CheckoutGuest',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          now,
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: guestStayAccountIds[2]!,
          reason: 'BalanceNotSettled',
          failedAt: now,
          groupCheckoutId,
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [],
          failedCheckouts: [
            guestStayAccountIds[0]!,
            guestStayAccountIds[1]!,
            guestStayAccountIds[2]!,
          ],
          failedAt: now,
        },
      },
    ]);
  });

  it('guest checkout for group checkout not on the to-do list fails', () => {
    const guestCheckedOut: GuestStayAccountEvent = {
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId: uuid(),
        checkedOutAt: now,
        groupCheckoutId: uuid(),
      },
    };

    expect(() => messageBus.publish([guestCheckedOut])).toThrow(
      'Entity not found',
    );
  });
});
