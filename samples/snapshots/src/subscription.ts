import {
  subscribeToAll,
  loadCheckpoint,
  storeCheckpoint,
} from '#core/eventStore/subscribing';
import { getEventStore } from '#core/eventStore';
import { storeCashRegisterSnapshotOnSubscription } from './cashiers/processCashRegister/storeCashRegisterSnapshotOnSubscription';

async function subscribe(reject: (error: any) => void, resolve: () => void) {
  try {
    const eventStore = getEventStore();

    const subscriptionResult = await subscribeToAll(
      eventStore,
      (subscriptionId) => loadCheckpoint(eventStore, subscriptionId),
      (subscriptionId, position) =>
        storeCheckpoint(eventStore, subscriptionId, position),
      [
        (event, options) =>
          storeCashRegisterSnapshotOnSubscription(event, options),
      ],
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
      .on('close', () => {
        resolve();
      })
      .on('end', () => {
        resolve();
      });
  } catch (error) {
    reject(error);
  }
}

(async () => {
  return new Promise<void>(async (resolve, reject) => {
    subscribe(resolve, reject);
  });
})();
