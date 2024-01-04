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

type HasRevisionOrPosition = { revision: number } | { position: number | Long };
type DocumentWithRevisionOrPosition = Document & HasRevisionOrPosition;

type EventWithMetadata<E> = { event: E; revision?: bigint; position?: bigint };

export type Spec<
  E extends Event,
  Doc extends DocumentWithRevisionOrPosition = DocumentWithRevisionOrPosition,
> = (...givenEvents: (E | EventWithMetadata<E>)[]) => {
  when: (...events: (E | EventWithMetadata<E>)[]) => {
    then: (id: string, expected: Doc) => Promise<void>;
    thenUpdated: (times: number) => Promise<void>;
    thenNotUpdated: () => Promise<void>;
  };
};

export const Spec = {
  for: <
    E extends Event,
    Doc extends DocumentWithRevisionOrPosition = DocumentWithRevisionOrPosition,
  >(
    collection: Collection<Doc>,
    project: (event: SubscriptionResolvedEvent) => Promise<UpdateResult>,
  ): Spec<E, Doc> => {
    {
      return (...givenEvents: (E | EventWithMetadata<E>)[]) => {
        return {
          when: (...events: (E | EventWithMetadata<E>)[]) => {
            const allEvents = [...givenEvents, ...events];

            const run = async () => {
              let position = 0n;
              let changesCount = 0;
              let acknowledgementCount = 0;

              for (const event of allEvents) {
                const options = {
                  position:
                    'position' in event && typeof event.position === 'bigint'
                      ? event.position
                      : position,
                  revision:
                    'revision' in event && typeof event.revision === 'bigint'
                      ? event.revision
                      : position,
                };

                const projectedEvent = toSubscriptionEvent(
                  'event' in event ? event.event : event,
                  options,
                );

                const result = await project(projectedEvent);

                changesCount += result.upsertedCount + result.modifiedCount;
                acknowledgementCount += result.acknowledged ? 1 : 0;

                position++;
              }

              expect(acknowledgementCount).toBe(allEvents.length);

              return { changesCount };
            };

            const thenUpdated = async (times: number): Promise<void> => {
              const { changesCount } = await run();

              expect(changesCount - givenEvents.length).toBe(times);
            };

            return {
              thenUpdated,
              thenNotUpdated: () => {
                return thenUpdated(0);
              },
              then: async (id: string, expected: Doc) => {
                await thenUpdated(events.length);

                return assertUpdated(collection, id, expected);
              },
            };
          },
        };
      };
    }
  },
};

const assertUpdated = async <Doc extends DocumentWithRevisionOrPosition>(
  collection: Collection<Doc>,
  id: string,
  expected: Doc,
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
  options: { position: bigint; revision: bigint },
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
