import { ProcessManager } from '../core';
import type {
  CheckoutGuest,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import type { InitiateGroupCheckout } from './groupCheckoutFacade';

export type GroupCheckoutInitiated = {
  type: 'GroupCheckoutInitiated';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    initiatedAt: Date;
  };
};

export type GuestCheckoutCompletionRecorded = {
  type: 'GuestCheckoutCompletionRecorded';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    checkedOutAt: Date;
  };
};

export type GuestCheckoutFailureRecorded = {
  type: 'GuestCheckoutFailureRecorded';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    failedAt: Date;
  };
};

export type GroupCheckoutCompleted = {
  type: 'GroupCheckoutCompleted';
  data: {
    groupCheckoutId: string;
    completedCheckouts: string[];
    completedAt: Date;
  };
};

export type GroupCheckoutFailed = {
  type: 'GroupCheckoutFailed';
  data: {
    groupCheckoutId: string;
    completedCheckouts: string[];
    failedCheckouts: string[];
    failedAt: Date;
  };
};

export type GroupCheckoutEvent =
  | GroupCheckoutInitiated
  | GuestCheckoutCompletionRecorded
  | GuestCheckoutFailureRecorded
  | GroupCheckoutCompleted
  | GroupCheckoutFailed;

export type CheckoutStatus =
  | 'NotExisting'
  | 'Initiated'
  | 'Completed'
  | 'Failed';

export class GroupCheckout extends ProcessManager<
  CheckoutGuest,
  GroupCheckoutEvent
> {
  private groupCheckoutId: string = '';
  private guestStayCheckouts: Map<string, CheckoutStatus> = new Map();
  private status: CheckoutStatus = 'NotExisting';

  private constructor() {
    super();
  }

  static initial = () => new GroupCheckout();

  static initiate = ({
    data: command,
  }: InitiateGroupCheckout): GroupCheckout => {
    const { groupCheckoutId, clerkId, guestStayIds, now } = command;
    const groupCheckout = new GroupCheckout();

    groupCheckout.enqueue({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId,
        clerkId: clerkId,
        guestStayAccountIds: guestStayIds,
        initiatedAt: now,
      },
    });

    for (const guestStayAccountId of guestStayIds) {
      groupCheckout.schedule({
        type: 'CheckoutGuest',
        data: { guestStayAccountId, groupCheckoutId, now },
      });
    }

    return groupCheckout;
  };

  onGuestCheckedOut = ({ data: event }: GuestCheckedOut): void => {
    if (event.groupCheckoutId !== this.groupCheckoutId) return;

    this.enqueue({
      type: 'GuestCheckoutCompletionRecorded',
      data: {
        groupCheckoutId: event.groupCheckoutId,
        guestStayAccountId: event.guestStayAccountId,
        checkedOutAt: event.checkedOutAt,
      },
    });
    this.guestStayCheckouts.set(event.guestStayAccountId, 'Completed');

    if (!this.areAnyOngoingCheckouts()) this.finish(event.checkedOutAt);
  };

  onGuestCheckoutFailed = ({ data: event }: GuestCheckoutFailed): void => {
    if (event.groupCheckoutId !== this.groupCheckoutId) return;

    this.enqueue({
      type: 'GuestCheckoutFailureRecorded',
      data: {
        groupCheckoutId: event.groupCheckoutId,
        guestStayAccountId: event.guestStayAccountId,
        failedAt: event.failedAt,
      },
    });
    this.guestStayCheckouts.set(event.guestStayAccountId, 'Failed');

    if (!this.areAnyOngoingCheckouts()) this.finish(event.failedAt);
  };

  private areAnyOngoingCheckouts = () =>
    [...this.guestStayCheckouts.values()].some(
      (status) => status === 'Initiated',
    );

  private areAllCompleted = () =>
    [...this.guestStayCheckouts.values()].every(
      (status) => status === 'Completed',
    );

  private checkoutsWith = (status: CheckoutStatus): string[] =>
    [...this.guestStayCheckouts]
      .filter((s) => s[1] === status)
      .map((s) => s[0]);

  private finish = (now: Date): void =>
    this.enqueue(
      this.areAllCompleted()
        ? {
            type: 'GroupCheckoutCompleted',
            data: {
              groupCheckoutId: this.groupCheckoutId,
              completedCheckouts: Array.from(this.guestStayCheckouts.keys()),
              completedAt: now,
            },
          }
        : {
            type: 'GroupCheckoutFailed',
            data: {
              groupCheckoutId: this.groupCheckoutId,
              completedCheckouts: this.checkoutsWith('Completed'),
              failedCheckouts: this.checkoutsWith('Failed'),
              failedAt: now,
            },
          },
    );

  evolve = ({ type, data: event }: GroupCheckoutEvent): void => {
    switch (type) {
      case 'GroupCheckoutInitiated': {
        if (this.status !== 'NotExisting') return;

        this.groupCheckoutId = event.groupCheckoutId;
        this.status = 'Initiated';
        this.guestStayCheckouts = event.guestStayAccountIds.reduce(
          (map, id) => map.set(id, 'Initiated'),
          new Map<string, CheckoutStatus>(),
        );
        return;
      }
      case 'GuestCheckoutCompletionRecorded':
      case 'GuestCheckoutFailureRecorded': {
        if (this.status !== 'Initiated') return;

        this.guestStayCheckouts.set(
          event.guestStayAccountId,
          type === 'GuestCheckoutCompletionRecorded' ? 'Completed' : 'Failed',
        );
        return;
      }
      case 'GroupCheckoutCompleted': {
        if (this.status !== 'Initiated') return;

        this.status = 'Failed';
        return;
      }
      case 'GroupCheckoutFailed': {
        if (this.status !== 'Initiated') return;

        this.status = 'Completed';
        return;
      }
      default: {
        const _notExistingEventType: never = type;
        return;
      }
    }
  };
}
