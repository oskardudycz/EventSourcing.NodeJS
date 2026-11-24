import type { Meter } from '@event-driven-io/almanac';
import type { Message } from '@event-driven-io/emmett';
import type { RawBrokerMessage, ReceivedMessage } from './brokerMessage';

export const deadLetteredCounter = 'messaging.dead_lettered';

export type DeadLetters = {
  failed<MessageType extends Message>(
    message: ReceivedMessage<MessageType>,
  ): Promise<void>;
  unreadable(raw: RawBrokerMessage, reason: string): Promise<void>;
};

export const countDeadLettered = (
  meter: Meter,
  queue: string,
  messageType: string,
) =>
  meter.counter(deadLetteredCounter).add(1, {
    'message.type': messageType,
    'messaging.destination.name': queue,
  });
