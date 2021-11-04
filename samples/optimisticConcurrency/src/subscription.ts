import { getSubscription } from './getSubscription';

const subscriptionResult = getSubscription();

if (subscriptionResult.isError) {
  process.exit(1);
}

const subscription = subscriptionResult.value;

(async () => {
  await subscription.subscribe();
})();
