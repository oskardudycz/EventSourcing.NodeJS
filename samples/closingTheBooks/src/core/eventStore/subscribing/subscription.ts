import { Readable } from 'stream';
import { Result, success } from '../../primitives';
import { resubscribeOnError } from './resubscribeOnError';

export type ESDBSubscription = Readable & {
  unsubscribe(): Promise<void>;
};

export class Subscription {
  private subscription: ESDBSubscription | undefined = undefined;
  constructor(private onSubscribe: () => Promise<Result<ESDBSubscription>>) {}

  public subscribe(): Promise<Result<boolean>> {
    return resubscribeOnError(() => {
      return new Promise<Result<boolean>>(async (resolve, reject) => {
        const subscriptionResult = await this.onSubscribe();

        if (subscriptionResult.isError) return subscriptionResult;

        this.subscription = subscriptionResult.value;

        this.subscription
          .on('error', async (error) => {
            console.error(`Received error: ${error ?? 'UNEXPECTED ERROR'}.`);
            reject(error);
          })
          .on('close', async () => {
            console.info(`Subscription closed.`);
            resolve(success(false));
          })
          .on('end', () => {
            console.info(`Received 'end' event. Stopping subscription.`);
            resolve(success(true));
          });

        return success(true);
      });
    });
  }

  async unsubscribe(): Promise<Result<true>> {
    await this.subscription?.unsubscribe();
    return success(true);
  }
}
