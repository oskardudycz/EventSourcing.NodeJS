import { getEventStore } from '#core/eventStore';
import { getSubscriptionToAllWithKurrentDBCheckpointing } from '#core/eventStore/subscribing';
import { projectToShoppingCartDetails } from './shoppingCarts/gettingById/projection';

export const getSubscription = () =>
  getSubscriptionToAllWithKurrentDBCheckpointing(getEventStore(), [
    projectToShoppingCartDetails,
  ]);
