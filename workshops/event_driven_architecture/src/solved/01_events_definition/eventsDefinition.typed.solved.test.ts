import { v4 as uuid } from 'uuid';

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

////////////////////////////////////////
///// Guest Stay Account Events ////////
////////////////////////////////////////

export type GuestCheckedIn = Event<
  'GuestCheckedIn',
  {
    guestStayAccountId: string;
    guestId: string;
    roomId: string;
    checkedInAt: Date;
  }
>;

export type ChargeRecorded = Event<
  'ChargeRecorded',
  {
    chargeId: string;
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  }
>;

export type PaymentRecorded = Event<
  'PaymentRecorded',
  {
    paymentId: string;
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  }
>;

export type GuestCheckedOut = Event<
  'GuestCheckedOut',
  {
    guestStayAccountId: string;
    checkedOutAt: Date;
    groupCheckoutId?: string;
  }
>;

export type GuestCheckoutFailed = Event<
  'GuestCheckoutFailed',
  {
    guestStayAccountId: string;
    reason: 'NotCheckedIn' | 'BalanceNotSettled';
    failedAt: Date;
    groupCheckoutId?: string;
  }
>;

export type GuestStayAccountEvent =
  | GuestCheckedIn
  | ChargeRecorded
  | PaymentRecorded
  | GuestCheckedOut
  | GuestCheckoutFailed;

////////////////////////////////////////
///// Group Checkout Account Events ////
////////////////////////////////////////

export type GroupCheckoutInitiated = Event<
  'GroupCheckoutInitiated',
  {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    initiatedAt: Date;
  }
>;

export type GuestCheckoutCompletionRecorded = Event<
  'GuestCheckoutCompletionRecorded',
  {
    groupCheckoutId: string;
    guestStayAccountId: string;
    checkedOutAt: Date;
  }
>;

export type GuestCheckoutFailureRecorded = Event<
  'GuestCheckoutFailureRecorded',
  {
    groupCheckoutId: string;
    guestStayAccountId: string;
    failedAt: Date;
  }
>;

export type GroupCheckoutCompleted = Event<
  'GroupCheckoutCompleted',
  {
    groupCheckoutId: string;
    completedCheckouts: string[];
    completedAt: Date;
  }
>;

export type GroupCheckoutFailed = Event<
  'GroupCheckoutFailed',
  {
    groupCheckoutId: string;
    completedCheckouts: string[];
    failedCheckouts: string[];
    failedAt: Date;
  }
>;

export type GroupCheckoutEvent =
  | GroupCheckoutInitiated
  | GuestCheckoutCompletionRecorded
  | GuestCheckoutFailureRecorded
  | GroupCheckoutCompleted
  | GroupCheckoutFailed;

describe('Events definition', () => {
  const guestId = uuid();
  const clerkId = 'room-123';
  const roomId = 'room-123';
  const groupCheckoutId = uuid();
  const guestStayAccountId = uuid();
  const otherGuestStayAccountId = uuid();

  it('Guest Stay Account event types are defined', () => {
    const events: GuestStayAccountEvent[] = [
      {
        type: 'GuestCheckedIn',
        data: {
          guestStayAccountId,
          guestId,
          roomId,
          checkedInAt: new Date(),
        },
      },
      {
        type: 'ChargeRecorded',
        data: {
          guestStayAccountId,
          chargeId: uuid(),
          amount: 123.45,
          recordedAt: new Date(),
        },
      },
      {
        type: 'PaymentRecorded',
        data: {
          guestStayAccountId,
          paymentId: uuid(),
          amount: 123.45,
          recordedAt: new Date(),
        },
      },
      {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId,
          checkedOutAt: new Date(),
          groupCheckoutId,
        },
      },
      {
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId,
          reason: 'NotCheckedIn',
          failedAt: new Date(),
          groupCheckoutId,
        },
      },
    ];

    expect(events.length).toBe(5);
  });

  it('Group Checkout event types are defined', () => {
    const events: GroupCheckoutEvent[] = [
      {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId,
          guestStayAccountIds: [guestStayAccountId],
          initiatedAt: new Date(),
        },
      },
      {
        type: 'GuestCheckoutCompletionRecorded',
        data: {
          guestStayAccountId,
          groupCheckoutId,
          checkedOutAt: new Date(),
        },
      },
      {
        type: 'GuestCheckoutFailureRecorded',
        data: {
          guestStayAccountId: otherGuestStayAccountId,
          groupCheckoutId,
          failedAt: new Date(),
        },
      },
      {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: [guestStayAccountId],
          completedAt: new Date(),
        },
      },
      {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: [guestStayAccountId],
          failedCheckouts: [otherGuestStayAccountId],
          failedAt: new Date(),
        },
      },
    ];

    expect(events.length).toBe(5);
  });
});
