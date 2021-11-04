import { sleep } from '#core/primitives';

export async function resubscribeOnError<T>(
  subscribe: () => Promise<T>
): Promise<T> {
  try {
    return await subscribe();
  } catch (error) {
    return await resubscribe(subscribe);
  }
}

async function resubscribe<T>(subscribe: () => Promise<T>): Promise<T> {
  let result: T | undefined = undefined;
  do {
    try {
      console.info('Starting reconnection');
      await sleep(1000);

      result = await subscribe();
    } catch (error) {
      console.error(
        `Received error while reconnecting: ${
          error ?? 'UNEXPECTED ERROR'
        }. Reconnecting.`
      );
    }
  } while (!result);

  return result;
}
