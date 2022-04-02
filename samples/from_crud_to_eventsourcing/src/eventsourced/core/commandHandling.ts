//////////////////////////////////////
/// ESDB
//////////////////////////////////////

import {
  AppendResult,
  EventStoreDBClient,
  jsonEvent,
  JSONEventType,
  NO_STREAM,
  ResolvedEvent,
  StreamingRead,
} from '@eventstore/db-client';

export const create =
  <Command, StreamEvent extends JSONEventType>(
    eventStore: EventStoreDBClient,
    handle: (command: Command) => StreamEvent
  ) =>
  (streamName: string, command: Command): Promise<AppendResult> => {
    const event = handle(command);

    return eventStore.appendToStream(streamName, jsonEvent(event), {
      expectedRevision: NO_STREAM,
    });
  };

export const update =
  <Command, StreamEvent extends JSONEventType>(
    eventStore: EventStoreDBClient,
    handle: (
      events: StreamingRead<ResolvedEvent<StreamEvent>>,
      command: Command
    ) => Promise<StreamEvent>
  ) =>
  async (
    streamName: string,
    command: Command,
    expectedRevision: bigint
  ): Promise<AppendResult> => {
    const readStream = eventStore.readStream(streamName);

    const event = await handle(readStream, command);

    const eventData = jsonEvent(event);

    return eventStore.appendToStream(streamName, eventData, {
      expectedRevision,
    });
  };
