import {
  subscribeToAll,
  loadCheckpoint,
  storeCheckpoint,
} from '#core/eventStore/subscribing';
import { getEventStore } from '#core/eventStore';
import { storeCashRegisterSnapshotOnSubscription } from './cashiers/processCashRegister/storeCashRegisterSnapshotOnSubscription';
import { sleep } from '#core/primitives';

async function subscribe() {
  return new Promise<void>(async (resolve, reject) => {
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
        throw subscriptionResult.error ?? 'ERROR WHILE SUBSCRIBING';
      }

      const subscription = subscriptionResult.value;

      subscription
        .on('error', async (error) => {
          console.error(
            `Received error: ${error ?? 'UNEXPECTED ERROR'}.
          Reconnecting.`
          );
          reject(error);
        })
        .on('close', async () => {
          console.error(
            `Subscription closed.
          Reconnecting.`
          );
          reject();
        })
        .on('end', () => {
          console.info(
            `Received 'end' event.
          Stopping subscription.`
          );
          resolve();
        });
    } catch (error) {
      console.error(
        `Received error while subscribing: ${error ?? 'UNEXPECTED ERROR'}.
      Reconnecting.`
      );
      reject(error ?? 'UNEXPECTED ERROR');
    }
  });
}

async function reconnect(): Promise<void> {
  do {
    try {
      console.info('Starting reconnection');
      await sleep(1000);

      await subscribe();
    } catch (error) {
      console.error(
        `Received error while reconnecting: ${error ?? 'UNEXPECTED ERROR'}.
        Reconnecting.`
      );
    }
  } while (true);
}

(async () => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      await subscribe();
      resolve();
    } catch (error) {
      await reconnect();
    }
  });
})();
