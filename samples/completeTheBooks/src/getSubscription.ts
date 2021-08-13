import { getEventStore } from '#core/eventStore';
import { getSubscriptionToAllWithESDBCheckpointing } from '#core/eventStore/subscribing';
import { projectToCurrentCashierShiftDetails } from './cashierShift/gettingCurrentCashierShiftDetails/projection';
import { handleCashRegisterPlacedAtWorkStation } from './cashierShift/initalizeCashRegisterShift/eventHandler';

export const getSubscription = () =>
  getSubscriptionToAllWithESDBCheckpointing(getEventStore(), [
    handleCashRegisterPlacedAtWorkStation,
    projectToCurrentCashierShiftDetails,
  ]);
