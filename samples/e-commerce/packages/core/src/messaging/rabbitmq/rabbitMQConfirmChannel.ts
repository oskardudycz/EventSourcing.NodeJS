import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import type { RabbitMQConnection } from './rabbitMQConnection';

export const defaultRabbitMQPublishTimeoutInMs = 10_000;

export type RabbitMQConfirmChannel = {
  current(): Promise<ConfirmChannel>;
  reset(): void;
  close(): Promise<void>;
};

export const rabbitMQConfirmChannel = ({
  connection: { url },
  publishTimeoutInMs = defaultRabbitMQPublishTimeoutInMs,
}: {
  connection: RabbitMQConnection;
  publishTimeoutInMs?: number;
}): RabbitMQConfirmChannel => {
  let open:
    Promise<{ model: ChannelModel; channel: ConfirmChannel }> | undefined;

  const close = async () => {
    const closing = open;
    open = undefined;
    const { model } = (await closing?.catch(() => undefined)) ?? {};
    await model?.close().catch(() => undefined);
  };

  const reset = () => {
    void close();
  };

  return {
    current: async () => {
      open ??= (async () => {
        const model = await connect(url, { timeout: publishTimeoutInMs });
        const forget = () => {
          open = undefined;
        };
        model.on('error', forget);
        model.on('close', forget);
        return { model, channel: await model.createConfirmChannel() };
      })();
      open.catch(() => {
        open = undefined;
      });

      return (await open).channel;
    },
    reset,
    close,
  };
};
