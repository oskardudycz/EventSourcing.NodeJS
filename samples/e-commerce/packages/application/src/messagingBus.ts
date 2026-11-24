import type { ChannelSubscription } from '@e-commerce/core';
import type {
  RecordedMessage,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import type { ApplicationMessage } from './application';

export const messagingBuses = [
  'kafka',
  'rabbitmq',
  'in-memory',
  'none',
] as const;

export type MessagingBus = (typeof messagingBuses)[number];

export type ChannelReading = <MessageType extends ApplicationMessage>(options: {
  subscription: ChannelSubscription;
  canHandle: readonly MessageType['type'][];
  handle: (
    message: RecordedMessage<MessageType>,
    context: WorkflowProcessorContext,
  ) => void | Promise<void>;
}) => void;
