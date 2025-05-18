export type GroupCheckoutEvent =
  | {
      type: 'GroupCheckoutInitiated';
      data: {
        groupCheckoutId: string;
        clerkId: string;
        guestStayAccountIds: string[];
        initiatedAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutCompletionRecorded';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        checkedOutAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutFailureRecorded';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        failedAt: Date;
      };
    }
  | {
      type: 'GroupCheckoutCompleted';
      data: {
        groupCheckoutId: string;
        completedCheckouts: string[];
        completedAt: Date;
      };
    }
  | {
      type: 'GroupCheckoutFailed';
      data: {
        groupCheckoutId: string;
        completedCheckouts: string[];
        failedCheckouts: string[];
        failedAt: Date;
      };
    };
