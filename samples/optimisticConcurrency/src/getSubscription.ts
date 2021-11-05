import { getEventStore } from '#core/eventStore';
import { getSubscriptionToAllWithESDBCheckpointing } from '#core/eventStore/subscribing';
import { projectToCurrentShoppingCartDetails } from './shoppingCarts/gettingById/projection';

export const getSubscription = () =>
  getSubscriptionToAllWithESDBCheckpointing(getEventStore(), [
    projectToCurrentShoppingCartDetails,
  ]);
