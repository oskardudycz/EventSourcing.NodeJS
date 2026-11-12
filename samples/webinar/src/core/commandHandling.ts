//////////////////////////////////////
/// KurrentDB
//////////////////////////////////////

import type {
  AppendResult,
  KurrentDBClient,
  JSONEventType,
  ResolvedEvent,
} from '@kurrent/kurrentdb-client';
import { jsonEvent, NO_STREAM } from '@kurrent/kurrentdb-client';

export const create =
  <Command, StreamEvent extends JSONEventType>(
    eventStore: KurrentDBClient,
    handle: (command: Command) => StreamEvent,
  ) =>
  (streamName: string, command: Command): Promise<AppendResult> => {
    const event = handle(command);

    return eventStore.appendToStream(streamName, jsonEvent(event), {
      streamState: NO_STREAM,
    });
  };

export const update =
  <Command, StreamEvent extends JSONEventType>(
    eventStore: KurrentDBClient,
    handle: (
      events: AsyncIterableIterator<ResolvedEvent<StreamEvent>>,
      command: Command,
    ) => Promise<StreamEvent>,
  ) =>
  async (
    streamName: string,
    command: Command,
    expectedRevision: bigint,
  ): Promise<AppendResult> => {
    const readStream = eventStore.readStream(streamName);

    const event = await handle(readStream, command);

    const eventData = jsonEvent(event);

    return eventStore.appendToStream(streamName, eventData, {
      streamState: expectedRevision,
    });
  };
