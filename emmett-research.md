# Emmett: which Node samples could move to emmett-postgresql, and missing Emmett workshop exercises

Status: research for discussion. Nothing below is implemented.

Emmett version: the workshop uses `@event-driven-io/emmett*` 0.43.0-rc.2 (Emmett repo HEAD: 0.43.0-rc.3). Emmett has: `CommandHandler`/`DeciderCommandHandler`, `DeciderSpecification`, `emmett-expressjs` (`getApplication`, ETag helpers, `on`), PostgreSQL event store with Pongo projections and `PostgreSQLProjectionSpec`, `Workflow`/`WorkflowHandler`/`WorkflowSpecification` (its tests even model the same `GroupCheckoutWorkflow`), in-memory message bus, processors/consumers, and `emmett-testcontainers`.

## Part 1: samples

What each sample uses from KurrentDB today (counts of client calls in `src`):

| Sample | KurrentDB features used | Other storage | Fit for emmett-postgresql | Notes |
| --- | --- | --- | --- | --- |
| `hotelManagement` | none in domain code (only the container infra test) | none | **Strong** | Saga, process manager and workflow are pure functions with no store and no tests. Emmett's `Workflow`/`WorkflowHandler` on PostgreSQL would make them run end to end, with `WorkflowSpecification` tests. Matches the .NET/JVM HotelManagement samples. |
| `decider` | `readStream`, `appendToStream`, `subscribeToAll` | MongoDB read models | **Strong** | Decider + ETag optimistic concurrency is exactly what `DeciderCommandHandler` and `emmett-expressjs` ETag helpers do. Read models as Pongo projections in the same PostgreSQL. |
| `webinar` | `readStream`, `appendToStream`, `subscribeToAll` | MongoDB read models | Good, but recording-tied | Basic CQRS with projections. Moving changes it away from what the recorded webinar shows. Option: keep as is, add an Emmett variant instead. |
| `from_crud_to_eventsourcing` | none (moved) | PostgreSQL | **Done** | Moved on 2026-11-15: CRUD on TypeORM, event-sourced on Emmett PostgreSQL with an inline raw SQL projection into the CRUD tables, `DeciderCommandHandler`, `emmett-expressjs`, and `DeciderSpecification`, `ApiSpecification` and `PostgreSQLProjectionSpec` tests. KurrentDB removed. |
| `eventsVersioning` | `readStream`, `appendToStream` (2 integration tests) | none | Partial | Mostly unit tests on mapping/upcasting/downcasting. The two integration tests could use Emmett's PostgreSQL store; check Emmett's upcasting hooks before moving the transformation examples. |
| `snapshots` | `setStreamMetadata`, `maxCount`, `subscribeToAll`, snapshot streams | none | **Keep on KurrentDB** | The sample is about KurrentDB-specific techniques (snapshot streams with `$maxCount`, stream metadata). |
| `closingTheBooks` | `setStreamMetadata`, `truncateBefore`, `maxCount`, subscriptions | MongoDB | **Keep on KurrentDB** | Relies on KurrentDB stream metadata and truncation; that's the point of the sample. |
| `unpeelingOnion` | none (KurrentDB dependency unused in `src`) | PostgreSQL, MongoDB | n/a | Architecture talk sample; doesn't use KurrentDB at all. The unused `@kurrent/kurrentdb-client` dependency could be removed. |

Suggested order if we move samples: `hotelManagement` (adds missing behaviour and tests), then `decider`. For `webinar`, decide between keeping it faithful to the recording or adding an Emmett variant next to it.

## Part 2: Introduction to Event Sourcing workshop, Emmett track

Current exercises and whether an Emmett variant exists (exercise / solved):

| # | Exercise | Emmett variant today |
| --- | --- | --- |
| 01 | Events definition | solved only (`eventsDefinition.emmett.solved.test.ts`); the exercise has one generic test |
| 02 | Getting state from events | no (pure functions, no Emmett needed) |
| 03 / 04 | Appending events | 04: Emmett on KurrentDB, MongoDB, PostgreSQL (exercise + solved) |
| 05 / 06 | Getting state from events read from the store | 06: Emmett on KurrentDB, MongoDB, PostgreSQL (exercise + solved) |
| 07 | Business logic | **missing** |
| 08 | Business logic tests | uses Emmett `DeciderSpecification` (exercise + solved) |
| 09 | Application logic (Web API) | **missing** (KurrentDB raw client + Express only) |
| 10 | Optimistic concurrency | **missing** (KurrentDB raw client only) |
| 11-13 | Projections (single stream, idempotency, eventual consistency) | no (generic, in-memory database) |
| 14 | Projections with Emmett | MongoDB only; **PostgreSQL (Pongo) missing** |
| 15 | Processes events definition | solved only |
| 16 | Processes entities definition | **missing** |
| 17 | Business processes | **missing** |

Proposed additions (each with exercise + solved, following the existing layout and naming: `*.exercise.test.ts` / `*.solved.test.ts`, local READMEs, solved READMEs linking only inside `solved`):

1. **07 business logic with Emmett**: decider (`decide`/`evolve`/`initialState`) for the shopping cart, using Emmett's `Decider` types and `IllegalStateError`/`ValidationError`.
2. **09 application logic with Emmett** (new folder, e.g. `09_application_logic_emmett`): Express API with `emmett-expressjs` `getApplication` and `on`, `CommandHandler` on the PostgreSQL event store (and optionally MongoDB/KurrentDB like 04/06), API tests with `ApiSpecification`/`ApiE2ESpecification`.
3. **10 optimistic concurrency with Emmett** (`10_optimistic_concurrency_emmett`): `If-Match`/`ETag` with Emmett's ETag helpers and `expectedStreamVersion`.
4. **14 projections with Emmett on PostgreSQL**: Pongo single-stream projection with `PostgreSQLProjectionSpec`, next to the MongoDB one.
5. **01 and 15 exercises**: add the Emmett exercise files where only solved exist, or say in the README that the Emmett solution is one of the variants (decide which).
6. **16 and 17 with Emmett**: entities as deciders, and the group checkout as an Emmett `Workflow` with `WorkflowSpecification` tests, on the in-memory message bus (and PostgreSQL consumer for the end-to-end variant).
7. Update the workshop README, root README exercise list, and CI (`test:solved` already runs everything).

Renumbering: adding new folders next to the existing numbers (e.g. `09_application_logic_emmett`) keeps current numbers and links stable, like `03`/`04` and `05`/`06` do today. The alternative is renumbering everything into pairs, which breaks links in READMEs and blog posts.

## Questions

1. Samples: move `hotelManagement` and `decider` to Emmett on PostgreSQL? For `webinar`: move, add an Emmett variant, or keep as recorded? (`from_crud_to_eventsourcing` is moved.)
2. Workshop: which of the proposed additions (1-6)? All, or a subset first (e.g. 07, 09, 10, 14 PostgreSQL)?
3. Storages for new Emmett exercises: PostgreSQL only, or PostgreSQL + MongoDB + KurrentDB like 04/06?
4. Naming: add `*_emmett` folders next to existing numbers (stable links), or renumber?
5. Remove the unused `@kurrent/kurrentdb-client` dependency from `unpeelingOnion`?
6. Bump Emmett from 0.43.0-rc.2 to the latest release when doing this?
