import {
  MessageProcessor,
  type AnyRecordedMessageMetadata,
  type EventStore,
  type Message,
  type RecordedMessage,
  type SingleMessageHandlerResult,
  type WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import {
  appendToChannelStream,
  channelStreamName,
  isInAChannelStream,
  type ForwardedMessage,
} from './channels';
import { messageRouter, type MessageRoutes } from './messageRoutes';
import { retryInHandler, type HandlerRetryOptions } from './retryInHandler';

type ForwardingBaseOptions = HandlerRetryOptions & {
  channels: readonly string[];
  storeOf?: (channel: string) => EventStore | undefined;
};

export type ForwardingOptions<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
> = ForwardingBaseOptions & {
  routes: readonly MessageRoutes<ForwardedMessage<Outgoing>>[];
  map: (
    message: RecordedMessage<Input, MetadataType>,
    context: HandlerContext,
  ) => ForwardedMessage<Outgoing>[] | Promise<ForwardedMessage<Outgoing>[]>;
};

export type ForwardingAsItIsOptions<Input extends Message> =
  ForwardingBaseOptions & {
    routes: readonly MessageRoutes<ForwardedMessage<Input>>[];
    map?: never;
  };

export type ForwardingHandler<
  Input extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
> = (
  message: RecordedMessage<Input, MetadataType>,
  context: HandlerContext,
) => Promise<SingleMessageHandlerResult>;

export const getForwarderId = (options: { name: string }): string =>
  `emt:processor:forwarder:${options.name}`;

export const skippedAsAlreadyInAChannelStream = () =>
  Promise.resolve(
    MessageProcessor.result.skip({ reason: 'Already in a channel stream' }),
  );

export function forwardToChannels<Input extends Message>(
  options: ForwardingAsItIsOptions<Input>,
): ForwardingHandler<Input>;
export function forwardToChannels<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
>(
  options: ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext>,
): ForwardingHandler<Input, MetadataType, HandlerContext>;
export function forwardToChannels({
  channels,
  routes,
  storeOf = () => undefined,
  map = (message) => [message],
  retry,
  signal,
}:
  | ForwardingOptions<Message, Message>
  | ForwardingAsItIsOptions<Message>): ForwardingHandler<Message> {
  const router = messageRouter(routes, channels);

  return (message, context) =>
    isInAChannelStream(message)
      ? skippedAsAlreadyInAChannelStream()
      : retryInHandler(
          async () => {
            const routed = (await map(message, context)).map((forwarded) => ({
              forwarded,
              route: router.declaredRouteFor(forwarded),
            }));

            for (const { forwarded, route } of routed)
              await appendToChannelStream(
                storeOf(route.channel) ?? context.session.messageStore,
                channelStreamName(route.channel),
                forwarded,
                route.key,
              );
          },
          { retry, signal },
        );
}

export type ForwardTo = {
  <Input extends Message>(
    options: ForwardingAsItIsOptions<Input>,
  ): ForwardingHandler<Input>;
  <
    Input extends Message,
    Outgoing extends Message,
    MetadataType extends AnyRecordedMessageMetadata =
      AnyRecordedMessageMetadata,
    HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
  >(
    options: ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext>,
  ): ForwardingHandler<Input, MetadataType, HandlerContext>;
};

export const forwardingToChannels = (
  storeOf: (channel: string) => EventStore | undefined,
): ForwardTo => {
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
      ? forwardToChannels<Message, Message>({ ...options, storeOf })
      : forwardToChannels<Message>({ ...options, storeOf });
  }

  return forward;
};
