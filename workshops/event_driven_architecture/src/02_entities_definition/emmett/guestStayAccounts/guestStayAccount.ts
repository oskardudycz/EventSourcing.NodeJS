import type { Event } from '@event-driven-io/emmett';

export type GuestCheckedIn = Event<
  'GuestCheckedIn',
  {
    guestStayAccountId: string;
    openedAt: Date;
  }
>;

export type ChargeRecorded = Event<
  'ChargeRecorded',
  {
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  }
>;

export type PaymentRecorded = Event<
  'PaymentRecorded',
  {
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  }
>;

export type GuestCheckedOut = Event<
  'GuestCheckedOut',
  {
    guestStayAccountId: string;
    completedAt: Date;
    groupCheckoutId?: string;
  }
>;

export type FailureReason = 'InvalidState' | 'BalanceNotSettled';

export type GuestCheckoutFailed = Event<
  'GuestCheckoutFailed',
  {
    guestStayAccountId: string;
    reason: FailureReason;
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
