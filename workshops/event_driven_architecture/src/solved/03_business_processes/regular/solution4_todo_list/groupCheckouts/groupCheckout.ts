export type GroupCheckoutInitiated = {
  type: 'GroupCheckoutInitiated';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    initiatedAt: Date;
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
  GroupCheckoutInitiated | GroupCheckoutCompleted | GroupCheckoutFailed;

export type CheckoutStatus = 'Initiated' | 'Completed' | 'Failed';

export type GroupCheckout = {
  id: string;
  guestStayCheckouts: Record<string, CheckoutStatus>;
  updatedAt: Date;
};

export const initiated = (
  id: string,
  guestStayAccountIds: string[],
  initiatedAt: Date,
): GroupCheckout => ({
  id,
  guestStayCheckouts: Object.fromEntries(
    guestStayAccountIds.map((guestStayAccountId) => [
      guestStayAccountId,
      'Initiated' as const,
    ]),
  ),
  updatedAt: initiatedAt,
});

export const withCheckout = (
  groupCheckout: GroupCheckout,
  guestStayAccountId: string,
  status: CheckoutStatus,
  at: Date,
): GroupCheckout => ({
  ...groupCheckout,
  guestStayCheckouts: {
    ...groupCheckout.guestStayCheckouts,
    [guestStayAccountId]: status,
  },
  updatedAt: at,
});

export const areAnyOngoingCheckouts = ({ guestStayCheckouts }: GroupCheckout) =>
  Object.values(guestStayCheckouts).some((status) => status === 'Initiated');

export const areAnyFailedCheckouts = ({ guestStayCheckouts }: GroupCheckout) =>
  Object.values(guestStayCheckouts).some((status) => status === 'Failed');

export const checkoutsWith = (
  { guestStayCheckouts }: GroupCheckout,
  status: CheckoutStatus,
): string[] =>
  Object.entries(guestStayCheckouts)
    .filter(([, guestStayStatus]) => guestStayStatus === status)
    .map(([guestStayAccountId]) => guestStayAccountId);
