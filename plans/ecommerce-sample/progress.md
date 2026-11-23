
## Step 1. Workspace and the extended ApiE2ESpecification in the core package

Done. `samples/e-commerce` is an npm workspace with `packages/core` and `packages/application` (Node 24.22.1, Vitest, ESLint, Prettier; root scripts `build:ts`, `fix`, `lint`, `test`). `packages/core/src/testing/apiE2ESpecification.ts` has the steps (`send`, `timePasses`, `attempt`), hooks (`start`, `stop`), the catch-up loop and the expectations. 31 unit tests pass.

Deviations and open points:
- The `appended` option is a small port (`lastGlobalPosition`, `readAfter`), not an Emmett `EventStore`: Emmett's `EventStore` has no store-agnostic global read. Steps that use SQLite, PostgreSQL and KurrentDB need an adapter, and the Emmett port (step 20) keeps this shape.
- Catch-up has no timeout: a review asked to remove the unrequested option, a second asked for a bound like Java's. Decision needed.
- No CI workflow `samples_e_commerce.yml` yet; the plan does not name a step for it.
- Root test scripts filter on `.unit.spec`, `.int.spec`, `.api.spec`, `.e2e.spec`, because filtering on `api` or `e2e` also matches `apiE2ESpecification`.

## Step 2. Shopping carts, forwarding through channel streams, and type names

Done after the idiomatic review (`reviews/20261123T230000_idiomatic_review.md`) and its fixes. The cart module (`packages/application/src/shoppingCarts`: decider, facade, API, `Cart`, `CustomerShoppingCart` and `ShoppingCartSummary` inline Pongo projections, pricing, external event and forwarder) runs on the SQLite store. The core has urns, routings as plain functions, `forwardToChannels` and `fromChannel` handlers for Emmett reactors (Q57), `toWorkflowInbox`, `retryInHandler` on Emmett's `asyncRetry`, `conditionalRead` and long polling, and the `ApiE2ESpecification` on Emmett's assertions. The application runs with `MESSAGING_BUS=in-memory` (channel streams) and `none` (pure Emmett, Q56). `npm run lint`, `npm run build:ts` and `npm test` pass.

Changes to step 1: `ApiE2ESpecification.for` now takes `getEventStore` + `getApplication(eventStore)` like Emmett's `ApiSpecification` and records appends with `WrapEventStore`; the `appended` port is gone and `expectAppended` takes `[streamName, events]` like `expectNewEvents`.

Deviations and open points:
- `priceOf` is an `action` step of the core `ApiE2ESpecification` that sets the price of the changeable price calculator.
- `getETagFromIfNotMatch` in `emmett-honojs` reads the header `if-not-match`, not `if-none-match`, so `conditionalRead` reads `If-None-Match` itself and uses the other etag helpers.
- The `theForwarderRetriesWithGrowingBackOff` extra test is not written: `asyncRetry` has no fake clock. The retries are checked with short `minTimeout` values.
- The forwarder retries its whole handler. The summary is an inline projection (Q38), so a retry only reads it again.
- On SQLite a forwarder that retries a down broker keeps the processor transaction, and with it the write lock, open. Step 5 must check this for Kafka and RabbitMQ.
- The event-store forwarder appends through the processor's own session store, so the append and the checkpoint commit together.
- Reads of the cart wait up to 1 s for a missing cart (404 after 1 s), as Java's `ConditionalRead` does.
