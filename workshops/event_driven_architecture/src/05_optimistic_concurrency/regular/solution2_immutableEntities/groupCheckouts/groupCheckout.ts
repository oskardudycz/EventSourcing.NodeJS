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
    completedAt: Date;
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
  'NotExisting' | 'Initiated' | 'Completed' | 'Failed';

export type GroupCheckout =
  | { status: 'NotExisting' }
  | {
      status: 'Initiated';
      guestStayCheckouts: Record<string, CheckoutStatus>;
    }
  | {
      status: 'Completed' | 'Failed';
      guestStayCheckouts: Record<string, CheckoutStatus>;
    };

export const initial: GroupCheckout = {
  status: 'NotExisting',
};

export const evolve = (
  state: GroupCheckout,
  { type, data: event }: GroupCheckoutEvent,
): GroupCheckout => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      if (state.status !== 'NotExisting') return state;

      return {
        status: 'Initiated',
        guestStayCheckouts: Object.fromEntries(
          event.guestStayAccountIds.map((id) => [id, 'Initiated' as const]),
        ),
      };
    }
    case 'GuestCheckoutCompletionRecorded':
    case 'GuestCheckoutFailureRecorded': {
      if (state.status !== 'Initiated') return state;

      return {
        ...state,
        guestStayCheckouts: {
          ...state.guestStayCheckouts,
          [event.guestStayAccountId]:
            type === 'GuestCheckoutCompletionRecorded' ? 'Completed' : 'Failed',
        },
      };
    }
    case 'GroupCheckoutCompleted':
    case 'GroupCheckoutFailed': {
      if (state.status !== 'Initiated') return state;

      return {
        ...state,
        status: type === 'GroupCheckoutCompleted' ? 'Completed' : 'Failed',
      };
    }
    default: {
      const _notExistingEventType: never = type;
      return state;
    }
  }
};
