# Review: step 5 (application part)

Reviewed: the working tree files of the application wiring for step 5 of `plan.md` r6. Earlier reviews of this step: 20261124T092535_step5_core_review.md.

## Step

Checked: plan step 5, spec settings and bus sections, qa Q37 and Q40, the application and core files of this part, all new spec files.

### Step-1. 22.5 covers one of three kinds of outside command
Quote: "22.5 GIVEN an outside command (provider answer, warehouse answer, worker command)"; `correlation.int.spec.ts` sends only `ConfirmPaymentAuthorization`.
Consequence: a wrong correlation on the shipment inbox or the `-internal` path goes unseen.
Belongs to: implementation
Resolution: open

### Step-2. 22.1 is checked with the cart forwarder on Kafka only
Quote: "a forwarder sends a workflow's output command"; the test stops Kafka and checks out a cart.
Consequence: the `orders-requests` forwarder and RabbitMQ are not shown to retry.
Belongs to: implementation
Resolution: open

### Step-3. No application test reaches a queue with a binding key or `payments-requests` on a broker
Consequence: a wrong channel or queue name in the subscriptions passes every test (step 6 may catch it).
Belongs to: implementation
Resolution: open

### Step-4. 22.3 never runs on Kafka or RabbitMQ
Consequence: `sendingToKafka` and `sendingToRabbitMQ` with the `-internal` channels are untested at application level (both tests are `failsOnEmmett('#432')`).
Belongs to: implementation
Resolution: open

### Step-5. Weak tests
Quote: `aRestartContinuesAfterTheCheckpoint` compares event counts; `postgreSQLInlineProjectionsAreConsistentWithTheAppend` reads the cart, which waits up to 1 s; 25.1 echoes the settings and checks consumer counts; `aSendIsPreparedForAllMessagesBeforeAnyIsSent` covers only the channel forwarder, whose behaviour existed.
Consequence: they pass without the guarded behaviour (resume, consistency, the built bus, per-bus preparation).
Belongs to: implementation
Resolution: open

### Step-6. The forwarder for channel streams skips messages that are already in a channel stream
Quote: `forwardToChannels` returns `skip` for streams starting with `channel:`; Kafka and RabbitMQ forwarders do not.
Consequence: behaviour differs by bus; no qa entry.
Belongs to: qa
Resolution: open

### Step-7. Plan 22.2 does not match Emmett
Quote: "stops after appending outputs and before saving its checkpoint ... neither the outputs nor the checkpoint were saved".
Consequence: in Emmett the `outputHandler` runs as a separate message after the decision commits, so outputs stay and the handler runs again after a restart; `workflowTransaction.int.spec.ts` tests that.
Belongs to: plan
Resolution: open

### Step-8. Spec 25.4 says "SQLite file", settings use `SQLITE_FOLDER`; a missing folder is not specified
Belongs to: spec
Resolution: open

## Standards

Checked: AGENTS.md, all changed files, comments, `any`, casts, classes.

### Standards-1. Comments in `knownFailures.ts` and `kafkaTesting.ts` (older files)
Belongs to: implementation
Resolution: open

### Standards-2. Two exports named `messagingBuses` with different values
Consequence: importing the wrong one silently runs another set of buses.
Belongs to: implementation
Resolution: open

### Standards-3. `application.int.spec.ts` has its own polling helper; `until` exists
Belongs to: implementation
Resolution: open

### Standards-4. The "-internal" convention is a string suffix in `channelStores.ts` and the RabbitMQ forwarder
Belongs to: implementation
Resolution: open

### Standards-5. `channelStoreOf` returns `EventStore | undefined` but never undefined; two dead checks
Belongs to: implementation
Resolution: open

### Standards-6. Three copies of the overloaded `forward` function (needs Oskar's approval for a new abstraction)
Belongs to: implementation
Resolution: open

### Standards-7. `workflowTransaction.int.spec.ts` rebuilds the payments workflow wiring by hand
Belongs to: implementation
Resolution: open

Review: blocked
