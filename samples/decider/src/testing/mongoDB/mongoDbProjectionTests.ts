import {
  Collection,
  Document,
  Filter,
  Long,
  ObjectId,
  UpdateResult,
} from 'mongodb';
import { Event } from '#core/decider';
import { mongoObjectId, retryIfNotFound } from '#core/mongoDB';
import { SubscriptionResolvedEvent } from '#core/subscriptions';
import { AllStreamRecordedEvent } from '@eventstore/db-client';
import { assert } from 'console';

export const given = <
  Doc extends Document & HasRevisionOrPosition,
  E extends Event
>(
  collection: Collection<Doc>,
  ...events: Event[] | { event: E; revision?: bigint; position?: bigint }[]
) => {
  return {
    when: (
      project: (event: SubscriptionResolvedEvent) => Promise<UpdateResult>
    ) => {
      return {
        then: async (
          id: string,
          expected: Doc,
          options?: { changed?: number; acknowledged?: number }
        ) => {
          let position = 0n;
          let changesCount = 0;
          let acknowledgementCount = 0;

          for (const event of events) {
            const options = {
              position:
                'position' in event ? event.position ?? position : position,
              revision:
                'revision' in event ? event.revision ?? position : position,
            };

            const projectedEvent = toSubscriptionEvent(
              'event' in event ? event.event : event,
              options
            );

            const result = await project(projectedEvent);

            changesCount += result.upsertedCount;
            acknowledgementCount += result.acknowledged ? 1 : 0;

            position++;
          }

          if (options?.changed !== undefined) {
            expect(changesCount).toBe(options?.changed);
          }
          if (options?.acknowledged !== undefined) {
            expect(acknowledgementCount).toBe(options?.acknowledged);
          }

          await assertUpdated(collection, id, expected);
        },
      };
    },
  };
};

type HasRevisionOrPosition = { revision: number } | { position: number | Long };

const assertUpdated = async <Doc extends Document & HasRevisionOrPosition>(
  collection: Collection<Doc>,
  id: string,
  expected: Doc
) => {
  const objectId = new ObjectId(id);

  // Yes, MongoDB typings are far from perfect...
  const filter = {
    // filter by id
    _id: new ObjectId(objectId),
    // ensure that we got document at expected revision or position
    ...('revision' in expected
      ? { revision: expected.revision as number }
      : {}),
    ...('position' in expected
      ? { position: Long.fromBigInt(expected.position as bigint) }
      : {}),
  } as unknown as Filter<Doc>;

  const item = await retryIfNotFound(() => collection.findOne(filter));

  expect(item).toStrictEqual({ ...expected, _id: objectId });
};

const toSubscriptionEvent = <E extends Event>(
  event: E,
  options: { position: bigint; revision: bigint }
): SubscriptionResolvedEvent => {
  return {
    subscriptionId: mongoObjectId(),
    event: {
      ...event,
      revision: options.revision,
      position: { commit: options.position, prepare: options.position },
    } as unknown as AllStreamRecordedEvent,
  };
};
