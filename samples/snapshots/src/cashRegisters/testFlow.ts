import {
  AppendResult,
  END,
  ErrorType,
  EventData,
  EventStoreDBClient,
  excludeSystemEvents,
  jsonEvent,
  Position,
  ResolvedEvent,
  START,
  StreamNotFoundError,
} from '@eventstore/db-client';
import {
  AppendToStreamOptions,
  GetStreamMetadataOptions,
  ReadStreamOptions,
} from '@eventstore/db-client/dist/streams';

//////////////////////
// Event base types //
//////////////////////

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
  EventMetadata extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
  metadata?: Readonly<EventMetadata>;
}>;

type SnapshotMetadata = Readonly<{
  snapshottedStreamVersion: string;
}>;

type SnapshotEvent<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
  EventMetadata extends SnapshotMetadata = SnapshotMetadata,
> = Event<EventType, EventData, EventMetadata> & {
  metadata: Readonly<EventMetadata>;
};

////////////////////////
// Command base types //
////////////////////////

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
  CommandMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
  metadata?: Readonly<CommandMetadata>;
};

/////////////////////////
// Read events methods //
/////////////////////////

type STREAM_NOT_FOUND = 'STREAM_NOT_FOUND';

async function readFromStream<StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions,
): Promise<StreamEvent[] | STREAM_NOT_FOUND> {
  const events = [];
  try {
    for await (const { event } of eventStore.readStream<StreamEvent>(
      streamName,
      options,
    )) {
      if (!event) continue;

      events.push(<StreamEvent>{
        type: event.type,
        data: event.data,
        metadata: event.metadata,
      });
    }
    return events;
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return 'STREAM_NOT_FOUND';
    }

    throw error;
  }
}

async function readLastEventFromStream<StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
): Promise<StreamEvent | STREAM_NOT_FOUND> {
  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    maxCount: 1,
    fromRevision: END,
    direction: 'backwards',
  });

  if (events === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  return events[0];
}

////////////////////////
// Snapshots Handling //
////////////////////////

/// Read from the external snapshot

async function readEventsFromExternalSnapshot<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  getLastSnapshot: (
    streamName: string,
  ) => Promise<SnapshotStreamEvent | undefined>,
  eventStore: EventStoreDBClient,
  streamName: string,
): Promise<{
  events: (StreamEvent | SnapshotStreamEvent)[];
  lastSnapshotRevision?: bigint;
}> {
  const snapshot = await getLastSnapshot(streamName);

  const lastSnapshotRevision = snapshot
    ? BigInt(snapshot.metadata.snapshottedStreamVersion)
    : undefined;

  const streamEvents = await readFromStream<StreamEvent>(
    eventStore,
    streamName,
    {
      fromRevision: lastSnapshotRevision,
    },
  );

  if (streamEvents === 'STREAM_NOT_FOUND') throw 'STREAM_NOT_FOUND';

  const events = snapshot ? [snapshot, ...streamEvents] : streamEvents;

  return {
    events,
    lastSnapshotRevision,
  };
}

/// Read from the snapshot in the same stream

function addSnapshotPrefix(streamName: string): string {
  return `snapshot-${streamName}`;
}

async function readSnapshotFromSeparateStream<
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: EventStoreDBClient,
  streamName: string,
): Promise<SnapshotStreamEvent | undefined> {
  const snapshotStreamName = addSnapshotPrefix(streamName);

  const snapshot = await readLastEventFromStream<SnapshotStreamEvent>(
    eventStore,
    snapshotStreamName,
  );

  return snapshot !== 'STREAM_NOT_FOUND' ? snapshot : undefined;
}

async function readStreamMetadata<
  StreamMetadata extends Record<string, unknown>,
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: GetStreamMetadataOptions,
): Promise<StreamMetadata | undefined> {
  const result = await eventStore.getStreamMetadata<StreamMetadata>(
    streamName,
    options,
  );

  return result.metadata;
}

async function getLastSnapshotRevisionFromStreamMetadata(
  eventStore: EventStoreDBClient,
  streamName: string,
): Promise<bigint | undefined> {
  const streamMetadata = await readStreamMetadata<SnapshotMetadata>(
    eventStore,
    streamName,
  );

  return streamMetadata
    ? BigInt(streamMetadata.snapshottedStreamVersion)
    : undefined;
}

async function readEventsFromSnapshotInTheSameStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent & StreamEvent,
>(
  eventStore: EventStoreDBClient,
  streamName: string,
): Promise<(StreamEvent | SnapshotStreamEvent)[]> {
  const lastSnapshotRevision = await getLastSnapshotRevisionFromStreamMetadata(
    eventStore,
    streamName,
  );

  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    fromRevision: lastSnapshotRevision,
  });

  if (events === 'STREAM_NOT_FOUND') throw 'STREAM_NOT_FOUND';

  return events;
}

export function appendToStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  events: StreamEvent[],
  options?: AppendToStreamOptions,
): Promise<AppendResult> {
  const jsonEvents: EventData[] = events.map((event) =>
    jsonEvent({
      type: event.type,
      data: event.data as Record<string, unknown>,
      metadata: event.metadata,
    }),
  );

  return client.appendToStream(streamName, jsonEvents, options);
}

/// Append to the external snapshot

async function appendEventAndExternalSnapshot<
  State extends object = object,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  tryBuildSnapshot: (
    newEvent: StreamEvent,
    currentState: State,
    newStreamRevision: bigint,
  ) => SnapshotStreamEvent | undefined,
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string,
    lastSnapshotRevision?: bigint,
  ) => Promise<AppendResult>,
  eventStore: EventStoreDBClient,
  streamName: string,
  newEvent: StreamEvent,
  currentState: State,
  lastSnapshotRevision?: bigint,
): Promise<AppendResult> {
  const appendResult = await appendToStream(eventStore, streamName, [newEvent]);

  const snapshot = tryBuildSnapshot(
    newEvent,
    currentState,
    appendResult.nextExpectedRevision,
  );

  if (snapshot) {
    await appendSnapshot(snapshot, streamName, lastSnapshotRevision);
  }

  return appendResult;
}

async function appendSnapshotToSeparateStream<
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: EventStoreDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string,
  lastSnapshotRevision?: bigint,
): Promise<AppendResult> {
  const snapshotStreamName = addSnapshotPrefix(streamName);

  // If there was no snapshot made before,
  // set snapshot stream metadata $maxCount to 1.
  // This will make sure that there is only one snapshot event.
  if (lastSnapshotRevision === undefined) {
    await eventStore.setStreamMetadata(snapshotStreamName, { maxCount: 1 });
  }

  return appendToStream(eventStore, snapshotStreamName, [snapshot]);
}

async function appendEventAndSnapshotToTheSameStream<
  State extends object = object,
  StreamEvent extends Event = Event,
>(
  tryBuildSnapshot: (
    newEvent: StreamEvent,
    currentState: State,
  ) => StreamEvent | undefined,
  eventStore: EventStoreDBClient,
  streamName: string,
  newEvent: StreamEvent,
  currentState: State,
): Promise<AppendResult> {
  const snapshot = tryBuildSnapshot(newEvent, currentState);

  const eventsToAppend = snapshot ? [newEvent, snapshot] : [newEvent];

  const appendResult = await appendToStream(
    eventStore,
    streamName,
    eventsToAppend,
  );

  const snapshottedStreamVersion = appendResult.nextExpectedRevision.toString();

  await eventStore.setStreamMetadata<SnapshotMetadata>(streamName, {
    snapshottedStreamVersion,
  });

  return appendResult;
}

export function aggregateStream<Aggregate, StreamEvent extends Event>(
  events: StreamEvent[],
  when: (
    currentState: Partial<Aggregate>,
    event: StreamEvent,
  ) => Partial<Aggregate>,
  check: (state: Partial<Aggregate>) => state is Aggregate,
): Aggregate {
  const state = events.reduce<Partial<Aggregate>>(when, {});

  return assertStateIsValid(state, check);
}

function applyEvent<Aggregate, StreamEvent extends Event>(
  currentState: Aggregate,
  event: StreamEvent,
  when: (
    currentState: Partial<Aggregate>,
    event: StreamEvent,
  ) => Partial<Aggregate>,
  check: (state: Partial<Aggregate>) => state is Aggregate,
): Aggregate {
  return assertStateIsValid(when(currentState, event), check);
}

export function assertStateIsValid<Aggregate>(
  state: Partial<Aggregate>,
  check: (state: Partial<Aggregate>) => state is Aggregate,
) {
  if (!check(state)) throw 'Aggregate state is not valid';

  return state;
}

/////////////////////////
// Cash Register types //
/////////////////////////

type CashRegister = {
  id: string;
  float: number;
  workstation: string;
  currentCashierId?: string;
};

type CashRegisterSnapshoted = SnapshotEvent<
  'cash-register-snapshoted',
  CashRegister
>;

type PlacedAtWorkStation = Event<
  'placed-at-workstation',
  {
    cashRegisterId: string;
    workstation: string;
    placedAt: Date;
  }
>;

type ShiftStarted = Event<
  'shift-started',
  {
    cashRegisterId: string;
    cashierId: string;
    startedAt: Date;
  }
>;

export type TransactionRegistered = Event<
  'transaction-registered',
  {
    transactionId: string;
    cashRegisterId: string;
    amount: number;
    registeredAt: Date;
  }
>;

export type EndShift = Command<
  'end-shift',
  {
    cashRegisterId: string;
  }
>;

export type ShiftEnded = Event<
  'shift-finished',
  {
    cashRegisterId: string;
    finishedAt: Date;
  }
>;

type CashRegisterEvent =
  | PlacedAtWorkStation
  | ShiftStarted
  | TransactionRegistered
  | ShiftEnded
  | CashRegisterSnapshoted;

function when(
  currentState: Partial<CashRegister>,
  event: CashRegisterEvent,
): Partial<CashRegister> {
  switch (event.type) {
    case 'placed-at-workstation':
      return {
        id: event.data.cashRegisterId,
        workstation: event.data.workstation,
        float: 0,
      };
    case 'shift-started':
      return {
        ...currentState,
        currentCashierId: event.data.cashierId,
      };
    case 'transaction-registered':
      return {
        ...currentState,
        float: (currentState.float ?? 0) + event.data.amount,
      };
    case 'shift-finished':
      return {
        ...currentState,
        currentCashierId: undefined,
      };
    case 'cash-register-snapshoted':
      return {
        ...event.data,
      };
    default:
      // Unexpected event type
      return {
        ...currentState,
      };
  }
}

function isNotEmptyString(value: any): boolean {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveNumber(value: any): boolean {
  return typeof value === 'number' && value >= 0;
}

export function isCashRegister(
  cashRegister: any,
): cashRegister is CashRegister {
  return (
    cashRegister !== undefined &&
    isNotEmptyString(cashRegister.id) &&
    isPositiveNumber(cashRegister.float) &&
    isNotEmptyString(cashRegister.workstation) &&
    (cashRegister.currentCashierId === undefined ||
      isNotEmptyString(cashRegister.currentCashierId))
  );
}

function shouldDoSnapshot(newEvent: CashRegisterEvent): boolean {
  return newEvent.type === 'shift-finished';
}

function buildCashRegisterSnapshot(
  currentState: CashRegister,
  newStreamRevision: bigint,
): CashRegisterSnapshoted {
  return {
    type: 'cash-register-snapshoted',
    data: currentState,
    metadata: { snapshottedStreamVersion: newStreamRevision.toString() },
  };
}

function tryBuildCashRegisterSnapshot(
  newEvent: CashRegisterEvent,
  currentState: CashRegister,
  newStreamRevision: bigint,
): CashRegisterSnapshoted | undefined {
  if (shouldDoSnapshot(newEvent)) return undefined;

  return buildCashRegisterSnapshot(currentState, newStreamRevision);
}

function tryBuildCashRegisterSnapshotNoMetadata(
  newEvent: CashRegisterEvent,
  currentState: CashRegister,
): CashRegisterSnapshoted | undefined {
  // perform the check if snapshot should be made
  if (newEvent.type !== 'shift-finished') return undefined;

  return {
    type: 'cash-register-snapshoted',
    data: currentState,
    metadata: { snapshottedStreamVersion: undefined! },
  };
}

function endShift(
  events: CashRegisterEvent[],
  command: EndShift,
): {
  newState: CashRegister;
  newEvent: ShiftEnded;
} {
  const cashRegister = aggregateStream(events, when, isCashRegister);

  if (cashRegister.currentCashierId === undefined) {
    throw 'SHIFT_NOT_STARTED';
  }

  const newEvent: ShiftEnded = {
    type: 'shift-finished',
    data: {
      cashRegisterId: cashRegister.id,
      finishedAt: new Date(),
    },
  };

  return {
    newState: applyEvent(cashRegister, newEvent, when, isCashRegister),
    newEvent,
  };
}

///////////////////////////////////////////////////
// Handling with a snapshot in a separate stream //
///////////////////////////////////////////////////

async function readCashRegisterEvents(
  eventStore: EventStoreDBClient,
  streamName: string,
) {
  return readEventsFromExternalSnapshot<CashRegisterEvent>(
    (streamName) => readSnapshotFromSeparateStream(eventStore, streamName),
    eventStore,
    streamName,
  );
}

async function storeCashRegister(
  eventStore: EventStoreDBClient,
  streamName: string,
  newEvent: ShiftEnded,
  newState: CashRegister,
  lastSnapshotRevision?: bigint,
) {
  return appendEventAndExternalSnapshot(
    tryBuildCashRegisterSnapshot,
    (snapshot, streamName, lastSnapshotRevision) =>
      appendSnapshotToSeparateStream(
        eventStore,
        snapshot,
        streamName,
        lastSnapshotRevision,
      ),
    eventStore,
    streamName,
    newEvent,
    newState,
    lastSnapshotRevision,
  );
}

export async function handleEndShift(command: EndShift): Promise<void> {
  const eventStore = EventStoreDBClient.connectionString(
    `esdb://localhost:2113?tls=false`,
  );

  const streamName = `cashregister-${command.data.cashRegisterId}`;

  // 1. Read events and snapshot from the separate stream
  const { events, lastSnapshotRevision } = await readCashRegisterEvents(
    eventStore,
    streamName,
  );

  // 2. Perform business logic handling the command
  const { newState, newEvent } = endShift(events, command);

  // 3. Append the new event and snapshot
  await storeCashRegister(
    eventStore,
    streamName,
    newEvent,
    newState,
    lastSnapshotRevision,
  );
}

/////////////////////////////////////////////////
// Handling with a snapshot in the same stream //
/////////////////////////////////////////////////

async function readCashRegisterEventsSameSnapshotStream(
  eventStore: EventStoreDBClient,
  streamName: string,
) {
  return readEventsFromSnapshotInTheSameStream<CashRegisterEvent>(
    eventStore,
    streamName,
  );
}

async function storeCashRegisterSameSnapshotStream(
  eventStore: EventStoreDBClient,
  streamName: string,
  newEvent: ShiftEnded,
  newState: CashRegister,
) {
  return appendEventAndSnapshotToTheSameStream<CashRegister, CashRegisterEvent>(
    tryBuildCashRegisterSnapshotNoMetadata,
    eventStore,
    streamName,
    newEvent,
    newState,
  );
}

export async function handleEndShiftSameSnapshotStream(
  command: EndShift,
): Promise<void> {
  const eventStore = EventStoreDBClient.connectionString(
    `esdb://localhost:2113?tls=false`,
  );

  const streamName = `cashregister-${command.data.cashRegisterId}`;

  // 1. Read events and snapshot from the separate stream
  const events = await readCashRegisterEventsSameSnapshotStream(
    eventStore,
    streamName,
  );

  // 2. Perform business logic handling the command
  const { newState, newEvent } = endShift(events, command);

  // 3. Append the new event and snapshot
  await storeCashRegisterSameSnapshotStream(
    eventStore,
    streamName,
    newEvent,
    newState,
  );
}

//////////////////////////////////
// Snapshotting on subscription //
//////////////////////////////////

function loadCheckPoint(subscriptionId: string): Promise<Position | undefined> {
  throw new Error('Function not implemented.');
}

function tryDoSnapshot(
  eventStore: EventStoreDBClient,
  resolvedEvent: ResolvedEvent,
): Promise<void> {
  throw new Error('Function not implemented.');
}

function storeCheckpoint(
  subscriptionId: string,
  position: Position,
): Promise<void> {
  throw new Error('Function not implemented.');
}

(async () => {
  // 1. Run asynchronous process waiting for the subscription to end.
  return new Promise<void>(async (resolve, reject) => {
    try {
      const subscriptionId = 'SnapshottingSubscriptionToAll';

      const eventStore = EventStoreDBClient.connectionString(
        `esdb://localhost:2113?tls=false`,
      );

      // 2. Read checkpoint - last processed event position.
      const lastCheckpoint = await loadCheckPoint(subscriptionId);

      // 3. Subscribe to $all stream excluding system events
      eventStore
        .subscribeToAll({
          fromPosition: lastCheckpoint ?? START,
          filter: excludeSystemEvents(),
        })
        .on('data', async function (resolvedEvent) {
          // 4. Try to do snapshot
          await tryDoSnapshot(eventStore, resolvedEvent);

          // 5. Store new checkpoint
          await storeCheckpoint(subscriptionId, resolvedEvent.event!.position);
        })
        .on('error', (error) => {
          // 6. End asynchronous process with error
          reject(error);
        })
        // 7. When subscription finished end the process
        .on('close', () => resolve())
        .on('end', () => resolve());
    } catch (error) {
      reject(error);
    }
  });
})();

(async () => {
  // 1. Run asynchronous process waiting for the subscription to end.
  return new Promise<void>(async (resolve, reject) => {
    try {
      await subscribeToAll(reject, resolve);
    } catch (error) {
      reject(error);
    }
  });
})();

async function subscribeToAll(
  reject: (error: any) => void,
  resolve: () => void,
) {
  const subscriptionId = 'SnapshottingSubscriptionToAll';

  const eventStore = EventStoreDBClient.connectionString(
    `esdb://localhost:2113?tls=false`,
  );

  // 2. Read checkpoint - last processed event position.
  const lastCheckpoint = await loadCheckPoint(subscriptionId);

  // 3. Subscribe to $all stream excluding system events
  eventStore
    .subscribeToAll({
      fromPosition: lastCheckpoint ?? START,
      filter: excludeSystemEvents(),
    })
    .on('data', async function (resolvedEvent) {
      // 4. Try to do snapshot
      await tryDoSnapshot(eventStore, resolvedEvent);

      // 5. Store new checkpoint
      await storeCheckpoint(subscriptionId, resolvedEvent.event!.position);
    })
    .on('error', (error) => {
      // 6. End asynchronous process with error
      reject(error);
    })
    // 7. When subscription finished end the process
    .on('close', () => resolve())
    .on('end', () => resolve());
}

export async function snapshotCashRegisterOnSubscription(
  eventStore: EventStoreDBClient,
  resolvedEvent: ResolvedEvent,
): Promise<void> {
  const event = {
    type: resolvedEvent.event!.type,
    data: resolvedEvent.event!.data,
    metadata: resolvedEvent.event!.metadata,
  } as CashRegisterEvent;

  // 1. Check if snapshot should be made
  if (!shouldDoSnapshot(event)) return;

  const streamName = resolvedEvent.event!.streamId;

  // 2. Read stream events
  const { events, lastSnapshotRevision } = await readCashRegisterEvents(
    eventStore,
    streamName,
  );

  // 3. Build the current stream state
  const currentState = aggregateStream(events, when, isCashRegister);

  // 4. Create snapshot
  const snapshot = buildCashRegisterSnapshot(
    currentState,
    resolvedEvent.event!.revision,
  );

  // 5. Append the new event and snapshot
  await appendSnapshotToSeparateStream(
    eventStore,
    snapshot,
    streamName,
    lastSnapshotRevision,
  );
}

// const snapshotTreshold = 10n;

// function shouldDoSnapshot(
//   lastSnapshotRevision: bigint | undefined,
//   resolvedEvent: ResolvedEvent
// ): boolean {
//   return (
//     resolvedEvent.event &&
//     resolvedEvent.event.revision - (lastSnapshotRevision ?? 0n) >=
//       snapshotTreshold
//   );
// }

// const snapshotTreshold = 1000 * 60 * 3;

// function shouldDoSnapshot(
//   lastSnapshotTimestamp: number | undefined,
//   resolvedEvent: ResolvedEvent
// ): boolean {
//   return (
//     resolvedEvent.event &&
//     resolvedEvent.event.created - (lastSnapshotTimestamp ?? 0) >=
//       snapshotTreshold
//   );
// }
