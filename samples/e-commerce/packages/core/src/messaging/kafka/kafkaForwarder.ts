import { messagingMetrics } from '../messagingMetrics';
import type {
  AnyRecordedMessageMetadata,
  Message,
  RecordedMessage,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import { brokerBodyOf, brokerHeadersOf } from '../broker/brokerMessage';
import type { ForwardedMessage } from '../channels';
import {
  routedBatchOf,
  type ForwardingAsItIsOptions,
  type ForwardingHandler,
  type ForwardingOptions,
  type ForwardTo,
} from '../eventStoreForwarder';
import type { SendToChannel } from '../channelSender';
import { messageRouter } from '../messageRoutes';
import { retryInHandler } from '../retryInHandler';
import type { KafkaProducer } from './kafkaProducer';

type KafkaSending = { producer: KafkaProducer };

export type ForwardingToKafkaOptions<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
> = ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext> &
  KafkaSending;

export type ForwardingToKafkaAsItIsOptions<Input extends Message> =
  ForwardingAsItIsOptions<Input> & KafkaSending;

export function forwardToKafka<Input extends Message>(
  options: ForwardingToKafkaAsItIsOptions<Input>,
): ForwardingHandler<Input>;
export function forwardToKafka<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
>(
  options: ForwardingToKafkaOptions<
    Input,
    Outgoing,
    MetadataType,
    HandlerContext
  >,
): ForwardingHandler<Input, MetadataType, HandlerContext>;
export function forwardToKafka({
  producer,
  channels,
  routes,
  map = (message: RecordedMessage) => [message],
  retry,
  signal,
}:
  | ForwardingToKafkaOptions<Message, Message>
  | ForwardingToKafkaAsItIsOptions<Message>): ForwardingHandler<Message> {
  const router = messageRouter(routes, channels);
  const metrics = messagingMetrics();

  return (messages, context) =>
    retryInHandler(
      async () => {
        const routed = await routedBatchOf(messages, context, map, router);

        if (routed.length === 0) return;

        await producer.send({
          messages: routed.map(({ source, forwarded, channel, key }) => ({
            topic: channel,
            key,
            value: brokerBodyOf(forwarded.data),
            headers: brokerHeadersOf(forwarded, {
              traceId: forwarded.metadata.traceId ?? source.metadata.traceId,
              spanId: forwarded.metadata.spanId ?? source.metadata.spanId,
            }),
          })),
        });
        for (const { forwarded, channel } of routed)
          metrics.published(channel, forwarded.type);
      },
      { retry, signal },
    );
}

export const forwardingToKafka = (producer: KafkaProducer): ForwardTo => {
  function forward<Input extends Message>(
    options: ForwardingAsItIsOptions<Input>,
  ): ForwardingHandler<Input>;
  function forward<
    Input extends Message,
    Outgoing extends Message,
    MetadataType extends AnyRecordedMessageMetadata =
      AnyRecordedMessageMetadata,
    HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
  >(
    options: ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext>,
  ): ForwardingHandler<Input, MetadataType, HandlerContext>;
  function forward(
    options:
      ForwardingOptions<Message, Message> | ForwardingAsItIsOptions<Message>,
  ): ForwardingHandler<Message> {
    return options.map
      ? forwardToKafka<Message, Message>({ ...options, producer })
      : forwardToKafka<Message>({ ...options, producer });
  }

  return forward;
};

export const sendingToKafka =
  (producer: KafkaProducer): SendToChannel =>
  async <MessageType extends Message>(
    channel: string,
    key: string | undefined,
    message: ForwardedMessage<MessageType>,
  ) => {
    await producer.send({
      messages: [
        {
          topic: channel,
          key,
          value: brokerBodyOf(message.data),
          headers: brokerHeadersOf(message),
        },
      ],
    });
  };
