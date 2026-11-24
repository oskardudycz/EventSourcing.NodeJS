import type { EventStore, Message } from '@event-driven-io/emmett';
import {
  appendToChannelStream,
  channelStreamName,
  type ForwardedMessage,
} from './channels';
import { messageRouter, type MessageRoutes } from './messageRoutes';

export type SendToChannel = <MessageType extends Message>(
  channel: string,
  key: string | undefined,
  message: ForwardedMessage<MessageType>,
) => Promise<void>;

export const sendingToChannelStreams =
  (storeOf: (channel: string) => EventStore): SendToChannel =>
  <MessageType extends Message>(
    channel: string,
    key: string | undefined,
    message: ForwardedMessage<MessageType>,
  ) =>
    appendToChannelStream(
      storeOf(channel),
      channelStreamName(channel),
      message,
      key,
    ).then(() => undefined);

export const routedSender = <MessageType extends Message>(
  sendToChannel: SendToChannel,
  routes: readonly MessageRoutes<ForwardedMessage<MessageType>>[],
  channels: readonly string[],
) => {
  const router = messageRouter(routes, channels);

  return (message: ForwardedMessage<MessageType>) => {
    const { channel, key } = router.declaredRouteFor(message);

    return sendToChannel(channel, key, message);
  };
};
