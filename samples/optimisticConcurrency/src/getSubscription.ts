import { getEventStore } from '#core/eventStore';
import { getSubscriptionToAllWithESDBCheckpointing } from '#core/eventStore/subscribing';

export const getSubscription = () =>
  getSubscriptionToAllWithESDBCheckpointing(getEventStore(), []);
