import { getEventStore } from '#core/eventStore';
import { subscribeToAllWithESDBCheckpointing } from '#core/eventStore/subscribing';

(async () => {
  return subscribeToAllWithESDBCheckpointing(getEventStore(), []);
})();
