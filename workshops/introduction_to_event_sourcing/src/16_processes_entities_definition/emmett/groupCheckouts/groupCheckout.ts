import { type Event } from '@event-driven-io/emmett';

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
