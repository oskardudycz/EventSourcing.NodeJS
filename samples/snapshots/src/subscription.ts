import { subscribeToAll } from './core/eventStore/subscribing/subscribeToAll';
import { getEventStore } from './core/eventStore';
import {
  loadCheckpoint,
  storeCheckpoint,
} from './core/eventStore/subscribing/checkpoints';
import { storeSnapshotOnSubscription } from './cashiers/processCashRegister/storeSnapshotOnSubscription';

(async () => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const eventStore = getEventStore();

      const subscriptionResult = await subscribeToAll(
        eventStore,
        (subscriptionId) => loadCheckpoint(eventStore, subscriptionId),
        (subscriptionId, position) =>
          storeCheckpoint(eventStore, subscriptionId, position),
        [(event, options) => storeSnapshotOnSubscription(event, options)],
        'cash_register_subscription'
      );

      if (subscriptionResult.isError === true) {
        reject(subscriptionResult.error ?? 'ERROR WHILE SUBSCRIBING');
        return;
      }

      const subscription = subscriptionResult.value;

      subscription
        .on('error', (error) => {
          console.error(error ?? 'UNEXPECTED ERROR CLOSING');
          reject(error);
        })
        .on('close', () => resolve())
        .on('end', () => resolve());
    } catch (error) {
      reject(error);
    }
  });
})();
