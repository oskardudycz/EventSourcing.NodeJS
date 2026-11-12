import { getEventStore } from '#core/eventStore';
import { getSubscriptionToAllWithKurrentDBCheckpointing } from '#core/eventStore/subscribing';
import { handleCashierShiftOpened } from './cashierShift/archivingClosedShift/eventHandler';
import { projectToCurrentCashierShiftDetails } from './cashierShift/gettingCurrentCashierShiftDetails/projection';
import { handleCashRegisterPlacedAtWorkStation } from './cashierShift/initalizeCashRegisterShift/eventHandler';

export const getSubscription = () =>
  getSubscriptionToAllWithKurrentDBCheckpointing(getEventStore(), [
    handleCashRegisterPlacedAtWorkStation,
    projectToCurrentCashierShiftDetails,
    handleCashierShiftOpened,
  ]);
