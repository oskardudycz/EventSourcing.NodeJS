import type {
  AllStreamResolvedEvent,
  ReadableSubscription,
} from '@kurrent/kurrentdb-client';
import type { Result } from '../../primitives';
import { success } from '../../primitives';
import { resubscribeOnError } from './resubscribeOnError';

export type KurrentDBSubscription =
  ReadableSubscription<AllStreamResolvedEvent>;

export class Subscription {
  private subscription: KurrentDBSubscription | undefined = undefined;
  constructor(
    private onSubscribe: () => Promise<Result<KurrentDBSubscription>>,
  ) {}

  public subscribe(): Promise<Result<boolean>> {
    return resubscribeOnError(async () => {
      const subscriptionResult = await this.onSubscribe();

      return new Promise<Result<boolean>>((resolve, reject) => {
        if (subscriptionResult.isError) return subscriptionResult;

        this.subscription = subscriptionResult.value;

        this.subscription
          .on('error', (error) => {
            console.error(`Received error: %s.`, error ?? 'UNEXPECTED ERROR');
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
