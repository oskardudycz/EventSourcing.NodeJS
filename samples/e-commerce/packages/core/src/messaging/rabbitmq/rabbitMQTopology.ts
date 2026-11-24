import { connect } from 'amqplib';
import type { ChannelSubscription } from '../channels';
import type { RabbitMQConnection } from './rabbitMQConnection';

export const deadLetterExchangeOf = (queue: string) => `${queue}-dlx`;
export const deadLetterQueueOf = (queue: string) => `${queue}-dlq`;

export type RabbitMQTopology = {
  channels: readonly string[];
  queues: readonly ChannelSubscription[];
};

export const declareRabbitMQTopology = async (
  { url }: RabbitMQConnection,
  { channels, queues }: RabbitMQTopology,
) => {
  const connection = await connect(url);
  connection.on('error', () => undefined);

  try {
    const channel = await connection.createChannel();

    for (const exchange of new Set([
      ...channels,
      ...queues.map(({ channel }) => channel),
    ]))
      await channel.assertExchange(exchange, 'topic', { durable: true });

    for (const { channel: exchange, queue, bindingKey = '#' } of queues) {
      const deadLetterExchange = deadLetterExchangeOf(queue);
      const deadLetterQueue = deadLetterQueueOf(queue);

      await channel.assertExchange(deadLetterExchange, 'direct', {
        durable: true,
      });
      await channel.assertQueue(deadLetterQueue, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum' },
      });
      await channel.bindQueue(deadLetterQueue, deadLetterExchange, queue);

      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': deadLetterExchange,
          'x-dead-letter-routing-key': queue,
          'x-dead-letter-strategy': 'at-least-once',
          'x-overflow': 'reject-publish',
        },
      });
      await channel.bindQueue(queue, exchange, bindingKey);
    }

    await channel.close();
  } finally {
    await connection.close();
  }
};
