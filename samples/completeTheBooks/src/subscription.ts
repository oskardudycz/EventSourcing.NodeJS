import { getEventStore } from '#core/eventStore';
import { subscribeToAllWithESDBCheckpointing } from '#core/eventStore/subscribing';
import { handleCashRegisterPlacedAtWorkStation } from './cashierShift/initalizeCashRegisterShift/eventHandler';

(async () => {
  return subscribeToAllWithESDBCheckpointing(getEventStore(), [
    handleCashRegisterPlacedAtWorkStation,
  ]);
})();
