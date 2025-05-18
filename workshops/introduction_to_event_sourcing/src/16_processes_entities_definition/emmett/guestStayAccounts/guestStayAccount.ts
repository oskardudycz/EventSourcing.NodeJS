import { type Event } from '@event-driven-io/emmett';

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
