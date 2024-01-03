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
    [storeCashRegisterSnapshotOnSubscription],
    'cash_register_subscription',
  );
}

async function reconnect(): Promise<void> {
  let maxReconnectionCount = 10;
  do {
    try {
      console.info('Starting reconnection');
      await sleep(1000);

      await subscribe();
    } catch (error) {
      console.error('Received error while reconnectin.');
      console.error(error);
    }
  } while (--maxReconnectionCount > 0);
}

(async () => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise<void>(async (resolve) => {
    try {
      await subscribe();
      resolve();
    } catch (error) {
      await reconnect();
      resolve();
    }
  });
})().catch(console.error);
