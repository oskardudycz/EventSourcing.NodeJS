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
    return resubscribeOnError(async () => {
      const subscriptionResult = await this.onSubscribe();

      return new Promise<Result<boolean>>((resolve, reject) => {
        if (subscriptionResult.isError) return subscriptionResult;

        this.subscription = subscriptionResult.value;

        this.subscription
          .on('error', (error) => {
            console.error(`Received error: ${JSON.stringify(error)}.`);
            reject(error);
          })
          .on('close', () => {
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
