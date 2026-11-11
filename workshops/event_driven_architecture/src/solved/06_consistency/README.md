# Solution 06 - Consistency

Both solutions use the [transactional outbox](https://event-driven.io/en/outbox_inbox_patterns_and_delivery_guarantees_explained/), and each module (guest stay accounts, group checkouts) has its own outbox. The facades register a background job that publishes from it.

## [Publish asynchronously](./publish_asynchronously)

The facades store the state and its events in the outbox in one [transaction](./publish_asynchronously/tools/database.ts). Either both get stored or neither does, so a failed attempt can be retried safely.

The [background job](./publish_asynchronously/tools/outbox.ts) reads the events stored after the checkpoint, publishes them one by one in the order they were stored, and stores the position of each published event as the new checkpoint. Published events stay in the outbox.

Nothing gets lost and the order is kept. If storing the checkpoint fails after publishing, the event gets published again. That's at-least-once delivery, so the consumers need to be idempotent.

## [Publish right away](./publish_right_away)

The facades store the state and publish its events immediately. If publishing fails, they [store the events that weren't published](./publish_right_away/tools/outbox.ts) in the outbox. The background job publishes them and removes each published one.

There's no transaction and no waiting for the background job when everything works. It's best effort: events published later can arrive after newer ones, and if the process crashes between storing the state and storing the events, they're lost.

## Don't build it on your own

The in-memory outbox here is a simplification. A real one has more problems to solve:

- a database sequence is assigned before commit, so a transaction with a lower position can commit after one with a higher position. A checkpoint-based job can skip messages. Read [how to handle ordering in the Postgres outbox](https://event-driven.io/en/ordering_in_postgres_outbox/),
- polling the outbox all the time is wasteful and makes choosing the interval hard. Read [push-based outbox with Postgres logical replication](https://event-driven.io/en/push_based_outbox_pattern_with_postgres_logical_replication/),
- running the job on multiple instances without publishing the same message twice, retrying poisoned messages, cleaning up old ones, and monitoring the lag.

It's much harder than it seems. Use proven tooling instead:

- [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) - reads the outbox table from the database log and publishes to Kafka, works with any language,
- [pg-transactional-outbox](https://github.com/Zehelein/pg-transactional-outbox) - outbox and inbox for Node.js and PostgreSQL based on logical replication.
