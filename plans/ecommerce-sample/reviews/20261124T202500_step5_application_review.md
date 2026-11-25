# Review: step 5 (application part)

Reviewed: the working tree files of the application wiring for step 5 of `plan.md` r6. Earlier reviews of this step: 20261124T092535_step5_core_review.md.

## Step

Checked: plan step 5, spec settings and bus sections, qa Q37 and Q40, the application and core files of this part, all new spec files.

### Step-1. 22.5 covers one of three kinds of outside command
Quote: "22.5 GIVEN an outside command (provider answer, warehouse answer, worker command)"; `correlation.int.spec.ts` sends only `ConfirmPaymentAuthorization`.
Consequence: a wrong correlation on the shipment inbox or the `-internal` path goes unseen.
Belongs to: implementation
Resolution: fixed. `correlation.int.spec.ts` now checks all three kinds: a provider answer, a warehouse answer (shipments processors, answer `ConfirmPackageSent`) and a worker command delivered through the store and through `payments-internal`.

### Step-2. 22.1 is checked with the cart forwarder on Kafka only
Quote: "a forwarder sends a workflow's output command"; the test stops Kafka and checks out a cart.
Consequence: the `orders-requests` forwarder and RabbitMQ are not shown to retry.
Belongs to: implementation
Resolution: fixed. `infrastructure.int.spec.ts` runs the down-broker cases on Kafka and RabbitMQ: the cart forwarder and the `orders-requests` forwarder retry and send when the broker is back.

### Step-3. No application test reaches a queue with a binding key or `payments-requests` on a broker
Consequence: a wrong channel or queue name in the subscriptions passes every test (step 6 may catch it).
Belongs to: implementation
Resolution: fixed. `anOrderAsksPaymentsAndShipmentsAndHearsPaymentThroughTheQueueBoundToItsKey` runs on both brokers: `payments-requests`, `shipments-requests` and the `orders-payments-responses` queue with binding key `ecommerce.order.*`.

### Step-4. 22.3 never runs on Kafka or RabbitMQ
Consequence: `sendingToKafka` and `sendingToRabbitMQ` with the `-internal` channels are untested at application level (both tests are `failsOnEmmett('#432')`).
Belongs to: implementation
Resolution: fixed as far as Emmett allows. `internalDelivery.int.spec.ts` runs 22.3 on Kafka and RabbitMQ for both settings, marked `failsOnEmmett('#432')` (the worker reads a read model of events a processor appended), so it has not been seen passing yet.

### Step-5. Weak tests
Quote: `aRestartContinuesAfterTheCheckpoint` compares event counts; `postgreSQLInlineProjectionsAreConsistentWithTheAppend` reads the cart, which waits up to 1 s; 25.1 echoes the settings and checks consumer counts; `aSendIsPreparedForAllMessagesBeforeAnyIsSent` covers only the channel forwarder, whose behaviour existed.
Consequence: they pass without the guarded behaviour (resume, consistency, the built bus, per-bus preparation).
Belongs to: implementation
Resolution: fixed. The restart test now counts warehouse checks across the restart and checks that a new order is handled after it; the PostgreSQL test reads the Pongo read model right after the append, without the API's long poll; 25.1 builds the SQLite pairs and checks the order and the database files (the Kafka and RabbitMQ pairs are the end-to-end tests of `infrastructure.int.spec.ts`); `aSendIsPreparedForAllMessagesBeforeAnyIsSent` moved into the shared forwarding suite and runs on channels, Kafka and RabbitMQ.

### Step-6. The forwarder for channel streams skips messages that are already in a channel stream
Quote: `forwardToChannels` returns `skip` for streams starting with `channel:`; Kafka and RabbitMQ forwarders do not.
Consequence: behaviour differs by bus; no qa entry.
Belongs to: qa
Resolution: fixed. Kafka and RabbitMQ forwarders skip messages in channel streams like `forwardToChannels` (shared `skippedAsAlreadyInAChannelStream`); the shared suite has `aForwarderIgnoresMessagesThatAreAlreadyInAChannelStream` for all three; decided in qa Q72.

### Step-7. Plan 22.2 does not match Emmett
Quote: "stops after appending outputs and before saving its checkpoint ... neither the outputs nor the checkpoint were saved".
Consequence: in Emmett the `outputHandler` runs as a separate message after the decision commits, so outputs stay and the handler runs again after a restart; `workflowTransaction.int.spec.ts` tests that.
Belongs to: plan
Resolution: fixed in plan.md (Q72). The test is now `aFailedOutputHandlerRunsAgainAfterRestartAndTheInputIsDecidedOnce`.

### Step-8. Spec 25.4 says "SQLite file", settings use `SQLITE_FOLDER`; a missing folder is not specified
Belongs to: spec
Resolution: fixed in spec/plan (Q72). `SQLITE_FOLDER` that does not exist is created (`ensureSQLiteFolder`); test `aGivenSqliteFolderThatDoesNotExistIsCreatedAndKept`.

## Standards

Checked: AGENTS.md, all changed files, comments, `any`, casts, classes.

### Standards-1. Comments in `knownFailures.ts` and `kafkaTesting.ts` (older files)
Belongs to: implementation
Resolution: fixed. Comments removed from `knownFailures.ts` and `kafkaTesting.ts`.

### Standards-2. Two exports named `messagingBuses` with different values
Consequence: importing the wrong one silently runs another set of buses.
Belongs to: implementation
Resolution: fixed. The test application exports `testedMessagingBuses` and the type `TestedMessagingBus`.

### Standards-3. `application.int.spec.ts` has its own polling helper; `until` exists
Belongs to: implementation
Resolution: fixed. `application.int.spec.ts` uses `until`.

### Standards-4. The "-internal" convention is a string suffix in `channelStores.ts` and the RabbitMQ forwarder
Belongs to: implementation
Resolution: fixed. `isInternalChannel` in core `channels.ts` is used by `channelStores.ts` and the RabbitMQ forwarder.

### Standards-5. `channelStoreOf` returns `EventStore | undefined` but never undefined; two dead checks
Belongs to: implementation
Resolution: fixed. `channelStoreOf` returns `EventStore`; the two dead checks are gone.

### Standards-6. Three copies of the overloaded `forward` function (needs Oskar's approval for a new abstraction)
Belongs to: implementation
Resolution: not changed. The three `forward` functions differ only in the sender they close over; removing the duplication needs a new abstraction, which needs Oskar's approval.

### Standards-7. `workflowTransaction.int.spec.ts` rebuilds the payments workflow wiring by hand
Belongs to: implementation
Resolution: fixed. `workflowTransaction.int.spec.ts` uses `registerShipmentsProcessors` and the named fake `warehouse` (`stockCheckFails`), not hand-built wiring.

Review: blocked
