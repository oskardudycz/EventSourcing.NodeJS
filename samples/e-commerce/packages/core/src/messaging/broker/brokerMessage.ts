import {
  JSONSerializer,
  type Command,
  type Event,
  ProcessorCheckpoint,
  type DefaultRecord,
  type Message,
  type RecordedMessage,
  type RecordedMessageMetadataWithGlobalPosition,
} from '@event-driven-io/emmett';
import {
  channelStreamName,
  type ChannelMessageMetadata,
  type ForwardedMessage,
} from '../channels';

export const brokerHeaders = {
  type: 'message-type',
  kind: 'message-kind',
  messageId: 'message-id',
  correlationId: 'correlation-id',
  causationId: 'causation-id',
  traceId: 'trace-id',
  spanId: 'span-id',
} as const;

export type BrokerMessageHeaders = Record<string, string>;

export type BrokerMessageMetadata = RecordedMessageMetadataWithGlobalPosition &
  ChannelMessageMetadata & { headers: BrokerMessageHeaders };

export type AnyBrokerMessage =
  Event<string, DefaultRecord> | Command<string, DefaultRecord>;

export type ReceivedMessage<MessageType extends Message = AnyBrokerMessage> =
  RecordedMessage<MessageType, BrokerMessageMetadata>;

export const unknownMessageType = 'unknown';

export class UnreadableMessageError extends Error {
  constructor(
    readonly reason: string,
    readonly messageType: string | undefined,
  ) {
    super(reason);
  }
}

export type MessageTrace = { traceId?: string; spanId?: string };

export const brokerHeadersOf = <MessageType extends Message>(
  { type, kind, metadata }: ForwardedMessage<MessageType>,
  { traceId, spanId }: MessageTrace = metadata,
): BrokerMessageHeaders => {
  const headers: BrokerMessageHeaders = {
    [brokerHeaders.type]: type,
    [brokerHeaders.messageId]: metadata.messageId,
  };

  if (kind !== undefined) headers[brokerHeaders.kind] = kind;
  if (metadata.correlationId !== undefined)
    headers[brokerHeaders.correlationId] = metadata.correlationId;
  if (metadata.causationId !== undefined)
    headers[brokerHeaders.causationId] = metadata.causationId;
  if (traceId !== undefined) headers[brokerHeaders.traceId] = traceId;
  if (spanId !== undefined) headers[brokerHeaders.spanId] = spanId;

  return headers;
};

export const brokerBodyOf = (data: Message['data']): Buffer =>
  Buffer.from(JSONSerializer.serialize(data));

export type RawBrokerMessage = {
  key: string | undefined;
  headers: BrokerMessageHeaders;
  body: Buffer;
  position: bigint;
  sequence: string;
  fallbackMessageId?: string;
};

export type DecodeOptions = { channel: string };

const isRecord = (value: unknown): value is DefaultRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const decodeBrokerMessage = (
  {
    key,
    headers,
    body,
    position,
    sequence,
    fallbackMessageId,
  }: RawBrokerMessage,
  { channel }: DecodeOptions,
): ReceivedMessage => {
  const type = headers[brokerHeaders.type];

  if (type === undefined)
    throw new UnreadableMessageError('The message has no type header', type);

  const data = parseBody(body, type);

  const messageId = headers[brokerHeaders.messageId] ?? fallbackMessageId;

  if (messageId === undefined)
    throw new UnreadableMessageError('The message has no id', type);

  const metadata: BrokerMessageMetadata = {
    messageId,
    streamName: channelStreamName(channel),
    streamPosition: position,
    globalPosition: sequence,
    checkpoint: ProcessorCheckpoint(sequence),
    correlationId: headers[brokerHeaders.correlationId],
    causationId: headers[brokerHeaders.causationId],
    traceId: headers[brokerHeaders.traceId],
    spanId: headers[brokerHeaders.spanId],
    key,
    headers,
  };

  return headers[brokerHeaders.kind] === 'Command'
    ? {
        type,
        data,
        kind: 'Command',
        schemaVersion: 1,
        metadata: { ...metadata, now: new Date() },
      }
    : { type, data, kind: 'Event', schemaVersion: 1, metadata };
};

const parseBody = (body: Buffer, type: string): DefaultRecord => {
  try {
    const parsed = JSONSerializer.deserialize<unknown>(body.toString('utf-8'));

    if (isRecord(parsed)) return parsed;
  } catch {
    throw new UnreadableMessageError(
      `The body of '${type}' is not valid JSON`,
      type,
    );
  }

  throw new UnreadableMessageError(
    `The body of '${type}' is not a JSON object`,
    type,
  );
};
