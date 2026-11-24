import {
  bigIntProcessorCheckpoint,
  type ProcessorCheckpoint,
} from '@event-driven-io/emmett';

type Entry<Delivery> = {
  sequence: bigint;
  delivery: Delivery;
  skipped: boolean;
};

export type DeliveryLedger<Delivery> = {
  deliver(delivery: Delivery): ProcessorCheckpoint;
  handled(checkpoint: ProcessorCheckpoint): void;
  skip(checkpoint: ProcessorCheckpoint): Promise<void>;
  track(processorId: string, isActive: () => boolean): void;
  processorStarted(
    processorId: string,
    startedAfter?: ProcessorCheckpoint | null,
  ): void;
  processed(
    processorId: string,
    checkpoint: ProcessorCheckpoint | null,
  ): Promise<void>;
  checkpointAfter(pending: bigint): ProcessorCheckpoint | null;
  lastHandledCheckpoint(): ProcessorCheckpoint | null;
};

export const deliveryLedger = <Delivery>({
  settle,
}: {
  settle: (settled: Delivery[]) => Promise<void>;
}): DeliveryLedger<Delivery> => {
  let entries: Entry<Delivery>[] = [];
  const progress = new Map<string, bigint>();
  const activity = new Map<string, () => boolean>();
  let lastSequence = 0n;
  let lastHandled = 0n;
  let settling: Promise<void> = Promise.resolve();

  const lowestProgress = () => {
    const active = [...progress].filter(
      ([processorId]) => activity.get(processorId)?.() ?? true,
    );

    return active.length === 0
      ? 0n
      : active.reduce(
          (lowest, [, value]) => (value < lowest ? value : lowest),
          active[0]![1],
        );
  };

  const settleReady = () => {
    const lowest = lowestProgress();
    const ready: Entry<Delivery>[] = [];

    for (
      let next = entries[0];
      next !== undefined && (next.skipped || next.sequence <= lowest);
      next = entries[0]
    ) {
      ready.push(next);
      entries = entries.slice(1);
    }

    if (ready.length > 0)
      settling = settling.then(async () => {
        try {
          await settle(ready.map(({ delivery }) => delivery));
        } catch {
          entries = [...ready, ...entries];
        }
      });

    return settling;
  };

  return {
    deliver: (delivery) => {
      const sequence = ++lastSequence;
      entries.push({ sequence, delivery, skipped: false });
      if (sequence <= lowestProgress()) void settleReady();
      return bigIntProcessorCheckpoint(sequence);
    },
    handled: (checkpoint) => {
      const sequence = BigInt(checkpoint);
      if (sequence > lastHandled) lastHandled = sequence;
    },
    skip: (checkpoint) => {
      const sequence = BigInt(checkpoint);
      const entry = entries.find((e) => e.sequence === sequence);

      if (entry !== undefined) entry.skipped = true;

      return settleReady();
    },
    track: (processorId, isActive) => {
      activity.set(processorId, isActive);
    },
    processorStarted: (processorId, startedAfter = null) => {
      progress.set(
        processorId,
        progress.get(processorId) ??
          (startedAfter === null ? 0n : BigInt(startedAfter)),
      );
    },
    processed: (processorId, checkpoint) => {
      if (checkpoint !== null) progress.set(processorId, BigInt(checkpoint));
      return settleReady();
    },
    checkpointAfter: (pending) =>
      lastSequence + pending === 0n
        ? null
        : bigIntProcessorCheckpoint(lastSequence + pending),
    lastHandledCheckpoint: () =>
      lastHandled === 0n ? null : bigIntProcessorCheckpoint(lastHandled),
  };
};
