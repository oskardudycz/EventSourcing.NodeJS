import { messagingMetrics } from '../messagingMetrics';
import type {
  AnyRecordedMessageMetadata,
  Message,
  RecordedMessage,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import type { ConfirmChannel, Message as ReturnedMessage } from 'amqplib';
import {
  brokerBodyOf,
  brokerHeaders,
  brokerHeadersOf,
  type BrokerMessageHeaders,
} from '../broker/brokerMessage';
import { isInternalChannel, type ForwardedMessage } from '../channels';
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
import {
  defaultRabbitMQPublishTimeoutInMs,
  type RabbitMQConfirmChannel,
} from './rabbitMQConfirmChannel';

export const isMandatoryChannel = (channel: string) =>
  channel.endsWith('-requests') || isInternalChannel(channel);

type RabbitMQSending = {
  confirmChannel: RabbitMQConfirmChannel;
  publishTimeoutInMs?: number;
  isMandatory?: (exchange: string) => boolean;
};

export type ForwardingToRabbitMQOptions<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
> = ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext> &
  RabbitMQSending;

export type ForwardingToRabbitMQAsItIsOptions<Input extends Message> =
  ForwardingAsItIsOptions<Input> & RabbitMQSending;

const publishConfirmed = (
  channel: ConfirmChannel,
  {
    exchange,
    key,
    headers,
    body,
    mandatory,
  }: {
    exchange: string;
    key: string | undefined;
    headers: BrokerMessageHeaders;
    body: Buffer;
    mandatory: boolean;
  },
  timeoutInMs: number,
) =>
  new Promise<void>((resolve, reject) => {
    const correlationId = crypto.randomUUID();
    let returned = false;
    const onReturn = (message: ReturnedMessage) => {
      if (message.properties.correlationId === correlationId) returned = true;
    };
    const timer = setTimeout(
      () =>
        reject(
          new Error(`No confirmation from RabbitMQ within ${timeoutInMs} ms`),
        ),
      timeoutInMs,
    );
    channel.on('return', onReturn);

    channel.publish(
      exchange,
      key ?? '',
      body,
      {
        persistent: true,
        mandatory,
        contentType: 'application/json',
        messageId: headers[brokerHeaders.messageId],
        correlationId,
        headers,
      },
      (error) => {
        clearTimeout(timer);
        channel.off('return', onReturn);
        if (error)
          reject(error instanceof Error ? error : new Error(String(error)));
        else if (returned)
          reject(
            new Error(
              `RabbitMQ could not route the message to '${exchange}' with key '${key ?? ''}'`,
            ),
          );
        else resolve();
      },
    );
  });

export function forwardToRabbitMQ<Input extends Message>(
  options: ForwardingToRabbitMQAsItIsOptions<Input>,
): ForwardingHandler<Input>;
export function forwardToRabbitMQ<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
>(
  options: ForwardingToRabbitMQOptions<
    Input,
    Outgoing,
    MetadataType,
    HandlerContext
  >,
): ForwardingHandler<Input, MetadataType, HandlerContext>;
export function forwardToRabbitMQ({
  confirmChannel,
  publishTimeoutInMs = defaultRabbitMQPublishTimeoutInMs,
  isMandatory = isMandatoryChannel,
  channels,
  routes,
  map = (message: RecordedMessage) => [message],
  retry,
  signal,
}:
  | ForwardingToRabbitMQOptions<Message, Message>
  | ForwardingToRabbitMQAsItIsOptions<Message>): ForwardingHandler<Message> {
  const router = messageRouter(routes, channels);
  const metrics = messagingMetrics();

  return (messages, context) =>
    retryInHandler(
      async () => {
        const routed = await routedBatchOf(messages, context, map, router);

        if (routed.length === 0) return;

        const channel = await confirmChannel.current();

        try {
          await Promise.all(
            routed.map(({ source, forwarded, channel: exchange, key }) =>
              publishConfirmed(
                channel,
                {
                  exchange,
                  key,
                  headers: brokerHeadersOf(forwarded, {
                    traceId:
                      forwarded.metadata.traceId ?? source.metadata.traceId,
                    spanId: forwarded.metadata.spanId ?? source.metadata.spanId,
                  }),
                  body: brokerBodyOf(forwarded.data),
                  mandatory: isMandatory(exchange),
                },
                publishTimeoutInMs,
              ),
            ),
          );
        } catch (error) {
          confirmChannel.reset();
          throw error;
        }
        for (const { forwarded, channel: exchange } of routed)
          metrics.published(exchange, forwarded.type);
      },
      { retry, signal },
    );
}

export const forwardingToRabbitMQ = (sending: RabbitMQSending): ForwardTo => {
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
      ? forwardToRabbitMQ<Message, Message>({ ...options, ...sending })
      : forwardToRabbitMQ<Message>({ ...options, ...sending });
  }

  return forward;
};

export const sendingToRabbitMQ =
  ({
    confirmChannel,
    publishTimeoutInMs = defaultRabbitMQPublishTimeoutInMs,
    isMandatory = isMandatoryChannel,
  }: RabbitMQSending): SendToChannel =>
  async <MessageType extends Message>(
    channel: string,
    key: string | undefined,
    message: ForwardedMessage<MessageType>,
  ) => {
    try {
      await publishConfirmed(
        await confirmChannel.current(),
        {
          exchange: channel,
          key,
          headers: brokerHeadersOf(message),
          body: brokerBodyOf(message.data),
          mandatory: isMandatory(channel),
        },
        publishTimeoutInMs,
      );
    } catch (error) {
      confirmChannel.reset();
      throw error;
    }
  };
