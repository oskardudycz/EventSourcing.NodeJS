import {
  subscribeToAll,
  loadCheckpoint,
  storeCheckpoint,
} from '#core/eventStore/subscribing';
import { getEventStore } from '#core/eventStore';
import { storeCashRegisterSnapshotOnSubscription } from './cashRegisters/processCashRegister/storeCashRegisterSnapshotOnSubscription';
import { sleep } from '#core/primitives';

async function subscribe(): Promise<void> {
  const eventStore = getEventStore();

  await subscribeToAll(
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
}

async function reconnect(): Promise<void> {
  do {
    try {
      console.info('Starting reconnection');
      await sleep(1000);

      await subscribe();
    } catch (error) {
      console.error(
        `Received error while reconnecting: ${
          error ?? 'UNEXPECTED ERROR'
        }. Reconnecting.`
      );
    }
  } while (true);
}

(async () => {
  return new Promise<void>(async (resolve) => {
    try {
      await subscribe();
      resolve();
    } catch (error) {
      await reconnect();
      resolve();
    }
  });
})();
