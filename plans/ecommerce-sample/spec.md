# E-commerce sample on Emmett

Revision: 8

## Problem Statement

The Java repository has an e-commerce sample that teaches a distributed process across modules: an online shop where a later step can fail after earlier steps have finished, and the process must compensate. It shows event-sourced modules, a process manager, forwarders that publish external events with the event store as the outbox, timeouts, message brokers (Kafka and RabbitMQ), message versioning, server-rendered pages, API and message documentation, contract tests and telemetry.

The Node.js repository has no such sample. A Node.js developer who wants to learn the same patterns has to read Java. Emmett covers what happens inside each module, but not what happens between modules: it has no broker integration, no forwarder and no broker consumers (see [research/emmett-inventory.md](research/emmett-inventory.md#gaps-for-an-e-commerce-port)).

Goal: a Node.js sample in `samples/e-commerce` that teaches the same as the Java sample, built on Emmett wherever Emmett has the feature. The parts that Emmett lacks are written in the sample's core package, shaped so they can move to Emmett later (Q6, Q16).

## Solution

The sample is one Hono application (Q2) with four business modules (shopping carts, orders, payments, shipments) and shared shop pages. The modules talk only through messages that go through a broker. Each module uses Event Sourcing on Emmett: the shopping cart with a decider, orders, payments and shipments with workflows that decide their own events (Q65).

A purchase goes like this, the same as in Java:

```
customer          shopping carts      orders (workflow)        payments           shipments
   |  check out  ------>|                    |                      |                  |
   |                    |-- ShoppingCartCheckedOut -->|             |                  |
   |                    |                    |-- AuthorizePayment ->|                  |
   |                    |                    |-- ReserveStock ----------------------->|
   |  pays at the provider sandbox --------->|<-- PaymentAuthorized |                  |
   |                    |                    |<-- StockReserved ------------------------|
   |                    |                    |-- RequestFulfillment ----------------->|
   |  warehouse sandbox sends the package -->|<-- PackageWasSent -----------------------|
   |                    |                    |-- CapturePayment --->|                  |
   |                    |                    |<-- PaymentCaptured --|                  |
   |  order completed   |                    |                      |                  |
```

When a step fails (out of stock, refused fulfillment, failed capture, the customer never pays, the customer cancels), the order workflow compensates: it cancels the payment authorization and releases the stock that the order holds.

Every message that leaves a module is first written to the event store, and a forwarder sends it from there. The event store is the outbox (Q22):

```
API / worker / sandbox / workflow ──append──▶ event store ──forwarder──▶ broker ──forwarder──▶ workflow inbox ──▶ module
```

The pieces:

- **Modules** keep their entity, workflow (the cart: its decider and `CommandHandler`), events, commands, configuration and web API at the module root, with feature folders for read models and workers, as in Java.
- **Workflows** (Q4, Q44, Q65): each process is an Emmett `Workflow` with state, keyed by its id; a module may have more than one when it has more flows or features, and here each module has one: the order workflow (order id, Q23), a payment workflow (payment id) and a shipment workflow (shipment id). A workflow takes the commands and events addressed to it as inputs and decides its module's events itself, as Emmett's group checkout does (`InitiateGroupCheckout` in, `GroupCheckoutInitiated` out); there is no separate handler and no command is passed on or doubled. Its outputs are its own events and the commands it sends to other modules. Every workflow uses Emmett's inbox mode (Q25, Q47): an input is first stored in the workflow's stream, and the workflow processor handles the inputs one after another. Messages from other modules enter a workflow's inbox through a reactor on the receiving module's consumer (Q45). Forwarders send a workflow's outputs to other modules (Q65); the `outputHandler` only calls external tools (Q64).
- **Forwarders** are Emmett reactors on the event store consumer. Each one reads what a module recorded, sends it with the defined routings (message type to channel and routing key), and then saves its checkpoint (Q22, Q57). There is one forwarder handler per broker: Kafka, RabbitMQ, and channel streams in the event store (`MESSAGING_BUS=in-memory`). With `MESSAGING_BUS=none` there are no channels, and a module appends its external events to its own streams (Q56).
- **Delivery inside a module** (Q40): commands a module sends to itself reach its handler either through a regular consumer on the event store or through the broker's `-internal` channels, as a setting chooses.
- **Workers** close what timed out: unpaid orders, payments that were never authorized, and authorizations that expired. Each worker reads a to-do list read model and stores a command for each overdue item as an input of the workflow of that order or payment (Q22, Q65). The payment and warehouse sandboxes send their answers as inputs of their payment or shipment workflow the same way.
- **Three setups** (Q3, Q19): SQLite without a broker; Kafka + PostgreSQL; RabbitMQ + PostgreSQL. Two independent settings choose the broker and the event store, so other pairs also work (Q42). The SQLite setup needs no Docker.
- **Read models** are Pongo projections that run inline with the append: on SQLite with the SQLite store, on PostgreSQL otherwise (Q20, Q38, Q42). A module's read models are consistent with its own writes; lag happens only between modules (Q38).
- **Telemetry** (Q18): traces, metrics and logs go over OTLP to Grafana (otel-lgtm), with dashboards and alerts for the purchase flow.
- **Pages** are server-rendered with `hono/jsx` and htmx (Q2): products, cart, orders list, order status with live updates, and sandbox pages for the payment provider and the warehouse.
- **Documentation**: OpenAPI for the HTTP API, AsyncAPI for the messages, and an EventCatalog site generated from both (Q8).

The sample is an npm workspace (Q6) with two packages: the application, and one core package with the business-agnostic code that Emmett lacks (Q16). The core package has its own tests, and its parts move to Emmett later.

## Acceptance criteria

The scenarios come from the Java sample's tests and README. Where the Java sample answers with a status code or a message, the port answers with the same one. Order statuses are the Java ones: `Opened`, `Confirmed`, `Completed`, `ClosedUnpaid`, `Canceled`. An order is open when it is `Opened` or `Confirmed`.

### Shopping carts

1. A customer adds a product to their cart, so they can buy it later.
   1.1. GIVEN a customer with no open cart WHEN they add a product THEN a new cart opens with that product at the current price AND the response is 200 with the `ETag` of the new version.
   1.2. GIVEN an open cart that has the product WHEN the customer adds it again THEN the quantity grows AND the line keeps its first price.
   1.3. GIVEN the customer's cart was checked out WHEN they add a product THEN a new cart opens (cart number n+1).
   1.4. GIVEN two adds for one customer at the same time WHEN both append THEN the version conflict is retried (3 attempts in all) AND both products end up in the cart.
2. A customer removes a product from their cart, so they don't buy it.
   2.1. GIVEN an open cart with the product WHEN the customer removes it with `If-Match` of the current version THEN the line shrinks or goes away AND the response is 200 with the new `ETag`.
   2.2. GIVEN `If-Match` with an old version WHEN the customer removes a product THEN the response is 412 as problem details AND nothing is appended.
   2.3. GIVEN the product is not in the cart WHEN the customer removes it THEN the response is 409 as problem details.
3. A customer reads their current cart, so they see what they will buy.
   3.1. GIVEN an open cart WHEN the customer reads it THEN they get the lines, the total and the `ETag`.
   3.2. GIVEN no open cart WHEN the customer reads it THEN the response is 404.
   3.3. GIVEN `If-None-Match` with an older version AND the read model reaches a newer version within 1 s WHEN the customer reads the cart THEN the response is 200 with the newer cart.
   3.4. GIVEN `If-None-Match` with the current version AND nothing newer arrives within 1 s WHEN the customer reads the cart THEN the response is 304 after the 1 s wait.
4. A customer checks out, so the shop places an order.
   4.1. GIVEN an open cart with current prices WHEN the customer checks out with `If-Match` THEN the response is 202 with `Location: /customers/{customerId}/orders/{orderId}` AND the cart module sends `shopping_carts.external.ShoppingCartCheckedOut` with the cart id, customer id, product items, total price and time.
   4.2. GIVEN a price changed since the product was added WHEN the customer checks out THEN the response is 409 with the new `ETag` AND the cart records `ProductItemPriceChanged` AND stays open AND nothing is sent.
   4.3. GIVEN a checked-out cart WHEN the customer checks it out again THEN the response is 404 AND nothing is appended or sent.
   4.4. GIVEN `If-Match` with an old version WHEN the customer checks out THEN the response is 412.

### Orders

5. The orders module places an order when a cart is checked out, so the purchase starts.
   5.1. GIVEN `ShoppingCartCheckedOut` arrives WHEN the order workflow handles it THEN the order, with the id derived from the cart id, has status `Opened` and stage `AwaitingPayment` AND `AuthorizePayment` (payment id derived from the order id) and `ReserveStock` are published. That `OrderPlaced` is the decided event is checked in the workflow's unit tests.
   5.2. GIVEN the same `ShoppingCartCheckedOut` arrives twice WHEN the workflow handles both THEN one order exists AND `AuthorizePayment` and `ReserveStock` are published once each.
   5.3. GIVEN the order was placed WHEN the order workflow's output is forwarded THEN `AuthorizePayment` (payment id derived from the order id) and `ReserveStock` are both published, each with its routing key.
6. The order holds payment and stock before it commits, so nothing ships without both.
   6.1. GIVEN an `Opened` order WHEN `PaymentAuthorized` and `StockReserved` both arrive, in any order THEN the order status is `Confirmed` with the payment id and the shipment id after the second one, and `RequestFulfillment` is published then.
   6.2. GIVEN an order is confirmed WHEN the workflow's output is forwarded THEN `RequestFulfillment` is published.
   6.3. GIVEN a `Confirmed` order with an authorized payment and reserved stock WHEN `PackageWasSent` arrives THEN the order shows the package as sent AND `CapturePayment` is published.
   6.4. GIVEN a sent order WHEN `PaymentCaptured` arrives THEN the order status is `Completed`. The recorded events `OrderPaymentCaptured` and `OrderCompleted` are checked in the workflow's unit tests.
   6.5. GIVEN an order whose payment is `Retrying` WHEN `PaymentAuthorized` arrives for the old payment id THEN the order does not change. Nothing recorded is checked in the workflow's unit tests.
   6.6. GIVEN an `Opened` order with a pending payment WHEN `PaymentAuthorized` arrives with any payment id THEN the order shows the payment as authorized, as in Java.
   6.7. GIVEN a sent order WHEN `PaymentCaptured` or `PaymentFailed` arrives for a payment id that is not the order's current one THEN the order does not change AND nothing is published.
   6.8. GIVEN an order whose payment is authorized WHEN `payments.external.PaymentAuthorized` arrives again THEN the order does not change AND nothing is published. That the workflow decides no events is checked in its unit tests.
   6.9. GIVEN a `Completed` order WHEN `shipments.external.PackageWasSent` arrives late THEN the order stays `Completed` AND nothing is published.
7. The order compensates when a step fails, so the customer isn't charged for what they don't get.
   7.1. GIVEN an `Opened` order with a pending payment WHEN `ShipmentFailed` with `ProductsOutOfStock` arrives THEN the order shows the shipment failure at once AND stays `Opened`.
   7.2. GIVEN that order WHEN the payment then answers with `PaymentAuthorized` THEN the order status is `Canceled` AND `CancelPayment` is published.
   7.3. GIVEN a `Confirmed` order WHEN `ShipmentFailed` with `FulfillmentRejected` arrives THEN the order status is `Canceled` AND `CancelPayment` and `ReleaseStock` are published.
   7.4. GIVEN an `Opened` order WHEN `PaymentFailed` arrives THEN the order stays `Opened` with `dueAt` 7 days after the failure.
   7.5. GIVEN a `Confirmed` order that is not sent WHEN `PaymentFailed` arrives THEN the order status is `Canceled` AND `ReleaseStock` is published.
   7.6. GIVEN a sent order whose capture failed WHEN time passes beyond `dueAt` THEN the unpaid-orders worker stores `CloseUnpaidOrder` as an input of the order workflow AND the order status is `ClosedUnpaid`.
   7.7. GIVEN an `Opened` order whose payment failed WHEN time passes beyond `dueAt` THEN the order status is `Canceled`. The reason `PaymentFailed` is checked in the workflow's unit tests.
   7.8. GIVEN an `Opened` order whose payment failed WHEN the worker runs before `dueAt` THEN the order stays `Opened`.
8. A customer retries a failed payment, so they can still pay.
   8.1. GIVEN an order with a failed payment WHEN the customer posts `retry-payment` THEN the response is 202 AND the order shows a new current payment id derived from the order id and the attempt number AND `AuthorizePayment` is published for the new payment.
9. A customer cancels an order, so they don't buy it.
   9.1. GIVEN an `Opened` order with a pending payment and reserved stock WHEN the customer posts `cancel` THEN the response is 202 AND the order status is `Canceled` AND only `ReleaseStock` is published (reason `Requested` is checked in the workflow's unit tests).
   9.2. GIVEN a `Completed` order, or a `Confirmed` order that is paid and not sent WHEN the customer posts `cancel` THEN the response is 202 AND the order status does not change AND nothing is published.
   9.3. GIVEN an unknown order WHEN the customer posts `cancel` THEN the response is 404.
10. A customer reads their orders, so they know what happens.
    10.1. GIVEN orders of a customer WHEN they get `/customers/{customerId}/orders` THEN they get the orders, newest first, with placed time, total, progress and whether they shipped.
    10.2. GIVEN an order WHEN the customer gets its status THEN they get products, total, progress, stage, payment, shipment, carrier, tracking, current payment id and the possible actions (pay now, retry payment, cancel order) AND the `ETag`.
    10.3. GIVEN a cart was just checked out and the order isn't placed yet WHEN the customer gets the order status THEN the lookup is retried for up to 1 s AND the response is 200 if the order appears, else 404.
    10.4. GIVEN no order WHEN the customer gets its status THEN the response is 404.
    10.5. GIVEN `If-None-Match` with the current version AND nothing newer arrives within 1 s WHEN the customer gets the status THEN the response is 304.
11. A customer pays now, so the payment provider can authorize the payment.
    11.1. GIVEN an order with a pending payment WHEN the customer posts `payments/{paymentId}/checkout-session` THEN the response is 303 to `/sandbox/checkout/{sessionId}`, with the order status page as success and cancel URL.
    11.2. GIVEN an open checkout session WHEN the customer posts again THEN the response is 303 to the same session.
    11.3. GIVEN an unknown payment or a payment of another reference WHEN the customer posts THEN the response is 404.
    11.4. GIVEN a payment that is not pending WHEN the customer posts THEN the response is 409.
    11.5. GIVEN the provider is unreachable WHEN the customer posts THEN the response is 502.

### Payments

12. The payments module authorizes a payment, so the order can hold the money.
    12.1. GIVEN `AuthorizePayment` WHEN the payment workflow handles it THEN nothing is published AND the payment-timeout worker times the payment out when time moves 24 hours, and not when it moves 24 hours minus 1 minute (the recorded `PaymentAuthorizationRequested` with `timesOutAt` is checked in the workflow's unit tests).
    12.2. GIVEN the provider confirms WHEN `ConfirmPaymentAuthorization` arrives THEN the forwarder sends `payments.external.PaymentAuthorized` with the `referenceId`.
    12.3. GIVEN a pending payment WHEN time passes beyond `timesOutAt` THEN the payment-timeout worker stores `TimeOutPayment` as an input of the payment workflow AND the forwarder publishes `payments.external.PaymentFailed` AND the provider's checkout session is expired (`expire-checkout-session`).
13. The payments module captures a payment, so the shop gets the money.
    13.1. GIVEN an authorized payment WHEN `CapturePayment` arrives THEN the capture client asks the provider AND, on `ConfirmPaymentCapture`, the forwarder sends `payments.external.PaymentCaptured`.
    13.2. GIVEN the provider refuses the capture WHEN the capture client asks THEN the capture client's answer `FailPaymentCapture` becomes the payment workflow's next input AND the forwarder publishes `payments.external.PaymentFailed` (the reason `UnexpectedError` is checked in the workflow's unit tests).
    13.3. GIVEN an authorized payment WHEN time passes beyond `captureBefore` THEN the authorization-expiry worker stores `ExpirePaymentAuthorization` as an input of the payment workflow AND the forwarder publishes `payments.external.PaymentFailed`.
14. The payments module cancels a payment, so the customer's money is released.
    14.1. GIVEN an authorized payment WHEN `CancelPayment` arrives THEN the authorization client cancels at the provider.
    14.2. GIVEN a captured payment WHEN `CancelPayment` arrives THEN the provider is not called AND nothing is published.
    14.3. GIVEN a pending payment WHEN `TimeOutPayment` arrives before `timesOutAt` THEN the payment stays pending AND nothing is published.

### Shipments

15. The shipments module reserves stock, so the products are set aside for the order.
    15.1. GIVEN all products are available WHEN `ReserveStock` arrives THEN the warehouse is asked about the products AND `shipments.external.StockReserved` is published with the shipment id derived from the `referenceId`.
    15.2. GIVEN one product is out of stock WHEN `ReserveStock` arrives THEN nothing is reserved AND the forwarder publishes `shipments.external.ShipmentFailed` with reason `ProductsOutOfStock`.
16. The shipments module fulfills a shipment, so the package leaves the warehouse.
    16.1. GIVEN a reserved shipment WHEN `RequestFulfillment` arrives THEN the fulfillment client asks the warehouse.
    16.2. GIVEN the warehouse sends the package WHEN `ConfirmPackageSent` arrives THEN the forwarder publishes `shipments.external.PackageWasSent`.
    16.3. GIVEN the warehouse rejects WHEN `RejectFulfillment` arrives THEN the forwarder publishes `shipments.external.ShipmentFailed` with reason `FulfillmentRejected`.
    16.4. GIVEN a sent package WHEN `DeliverPackage` arrives THEN nothing is published. That `PackageWasDelivered` is recorded is checked in the workflow's unit tests.
    16.5. GIVEN a reserved shipment WHEN `ReleaseStock` arrives THEN the stock is released and nothing is published. That the rejected-fulfillment branch also records `StockReleased` is checked in the workflow's unit tests.

### Purchases across modules

17. Each purchase scenario runs on all three setups, so the sample shows the same behaviour on each.
    17.1. GIVEN a checked-out cart WHEN the purchase starts THEN the order is `Opened` AND the stock is reserved.
    17.2. GIVEN a placed order WHEN the customer pays at the provider sandbox, the warehouse sends the package and the capture succeeds THEN the order is `Completed`.
    17.3. GIVEN a placed order WHEN the customer posts `checkout-session` THEN the response is 303 to the sandbox checkout page AND no `payments.external.PaymentAuthorized` is sent until the customer pays there.
    17.4. GIVEN a product out of stock WHEN the customer checks out and pays THEN the order is `Canceled` AND the payment is canceled.
    17.5. GIVEN a `Confirmed` order WHEN the warehouse rejects the request THEN the order is `Canceled` AND the payment is canceled AND the stock is released.
    17.6. GIVEN a placed order WHEN the customer never pays and 24 hours pass THEN the payment times out AND the order stays `Opened` until `dueAt` AND then is `Canceled`.
    17.7. GIVEN a sent order WHEN the capture fails THEN the order waits for payment AND the customer retries the payment AND the order is `Completed`.
    17.8. GIVEN a sent order whose capture failed WHEN time passes beyond `dueAt` THEN the order is `ClosedUnpaid`.
    17.9. GIVEN an `Opened` order with a pending payment WHEN the customer cancels THEN the stock is released.

### Pages

18. A customer shops through pages, so the sample can be tried in a browser.
    18.1. GIVEN a visitor WHEN they open `/shop` THEN they log in with a name only (an HttpOnly `customer` cookie) AND see the five demo products, the last one sold out.
    18.2. GIVEN a logged-in customer WHEN they add and remove products THEN the cart page shows the change, waiting up to 1 s for the read model.
    18.3. GIVEN a cart WHEN the customer checks out THEN they are redirected to the order page, which shows "being placed" until the order exists, with a `<meta refresh>` fallback without JavaScript.
    18.4. GIVEN an order page WHEN the order changes THEN htmx polls every second while the order is not final AND the order part updates in place (304 when nothing changed within 1 s).
    18.5. GIVEN an order page WHEN the customer cancels or retries payment through the forms THEN the page shows the new state.
    18.6. GIVEN the payment sandbox page WHEN the customer pays with card `4242424242424242` THEN the sandbox stores `ConfirmPaymentAuthorization` with `captureBefore` 7 days later as an input of the payment workflow AND redirects (303) to the success URL.
    18.7. GIVEN the payment sandbox page WHEN the customer pays with card `4000000000000002` THEN the payment is declined AND the page stays.
    18.8. GIVEN the warehouse sandbox page WHEN a person sends a package THEN the warehouse stores `ConfirmPackageSent` with carrier "Sandbox Express" as an input of the shipment workflow; WHEN they reject THEN it stores `RejectFulfillment`; WHEN they deliver THEN it stores `DeliverPackage`.
    18.9. GIVEN the warehouse sandbox page WHEN a person marks a product out of stock THEN later `ReserveStock` for that product fails with `ProductsOutOfStock` AND no command is appended.
    18.10. GIVEN any page WHEN it renders THEN it links to the Grafana and EventCatalog URLs from the settings.

### Forwarding and routing

19. A forwarder sends what a module recorded, so the module that owns it receives it. These criteria hold for every broker; channel streams check them first.
    19.1. GIVEN a routing for the message type WHEN the forwarder reads the message from the event store THEN it sends it to the routing's channel with the routing's key AND then saves its checkpoint.
    19.2. GIVEN routing keys from URNs WHEN a command is sent THEN its key is its entity id's URN; WHEN an external event is sent THEN its key is its `referenceId`'s URN.
    19.3. GIVEN no routing for a type, or a routing to an undeclared channel WHEN the forwarder reads it THEN it fails with an error naming the type or the channel AND sends nothing for that message AND retries with back-off.
    19.4. GIVEN a Kafka or RabbitMQ forwarder fails after sending and before saving the checkpoint WHEN it restarts THEN it sends the same messages again with the same message ids. On channel streams the append and the checkpoint commit together.
    19.5. GIVEN an internal event WHEN the forwarder maps it to an external event THEN the external event's message id is derived from the internal event's id and the external type name, so a resend has the same id.
    19.6. GIVEN a forwarder that needs a summary (the cart's customer id, items and total; the `referenceId` of a payment or shipment) WHEN it handles an event THEN it reads its Pongo summary, which an inline projection updates in the module's own append, so it never lags behind (Q24, Q38, Q46).
    19.7. GIVEN channel streams WHEN a forwarder sends a message THEN it appends it to the stream `channel:<name>` with the routing key AND a reactor that reads that channel stores it in the receiving workflow's inbox (Q51, Q55) AND skips the copy of the same type in the source stream; nothing calls the receiving module's handlers inside the forwarder's processing.
    19.8. GIVEN `MESSAGING_BUS=none` WHEN the cart is checked out THEN the cart forwarder appends `shopping_carts.external.ShoppingCartCheckedOut` to a channel stream in the orders store AND the orders channel reactor stores it in the order workflow's inbox AND no module reads another module's store (Q60).

### Kafka

20. Modules exchange messages through Kafka, so the Kafka setup works like Java's.
    20.1. GIVEN queues bound with topic patterns (`*` one word, `#` zero or more) WHEN a message is sent THEN each queue whose pattern matches receives it.
    20.2. GIVEN a queue bound with a pattern other than `#` THEN it gets its own topic, filled by a routing consumer that copies the matching records.
    20.3. GIVEN the broker doesn't acknowledge a send within the publish timeout (10 s by default) THEN the send fails AND the forwarder retries with back-off.
    20.4. GIVEN the broker is down WHEN the forwarder sends THEN the send fails AND the forwarder retries with back-off, without a limit, AND sends once the broker is back.
    20.5. GIVEN a message from a Kafka queue for a workflow WHEN the broker-to-workflow forwarder takes it THEN it stores it in the workflow's inbox with `WorkflowHandler`'s store-only path AND commits the offset only after the store write (Q45).
    20.6. GIVEN a handler that fails once WHEN the message arrives THEN the consumer retries with exponential back-off from the initial interval (1 s by default) AND the second attempt succeeds.
    20.7. GIVEN a handler that keeps failing WHEN 2 retries run out THEN the message goes to `<queue>-dlt` AND the `messaging.dead_lettered` counter grows by 1 with the message type and the queue name.
    20.8. GIVEN a message with an unknown type name, no type header, or bad JSON WHEN it arrives THEN it goes to `<queue>-dlt` without retries.
    20.9. GIVEN the broker restarts WHEN the consumer reconnects THEN messages sent after the restart are handled.
    20.10. GIVEN messages in flight WHEN a test waits for catch-up THEN the wait ends when every consumer group has committed the offsets that were the end offsets when the wait started.
    20.11. GIVEN a sent message WHEN a consumer receives it THEN the headers have its type name, message id, correlation id, causation id and trace context.

### RabbitMQ

21. Modules exchange messages through RabbitMQ, so the RabbitMQ setup works like Java's.
    21.1. GIVEN queues bound with topic patterns (`*` one word, `#` zero or more) WHEN a message is sent THEN each queue whose pattern matches receives it.
    21.2. GIVEN a message on a `-requests` or `-internal` channel with no queue WHEN it is sent THEN the send fails. Responses and external events may have no queue.
    21.3. GIVEN the broker doesn't confirm a send within the publish timeout (10 s by default) THEN the send fails AND the forwarder retries with back-off.
    21.4. GIVEN the broker is down WHEN the forwarder sends THEN the send fails AND the forwarder retries with back-off, without a limit, AND sends once the broker is back.
    21.5. GIVEN a message from a RabbitMQ queue for a workflow WHEN the broker-to-workflow forwarder takes it THEN it stores it in the workflow's inbox with `WorkflowHandler`'s store-only path AND acknowledges it only after the store write (Q45).
    21.6. GIVEN a handler that fails once WHEN the message arrives THEN the consumer retries with exponential back-off from the initial interval (1 s by default) AND the second attempt succeeds.
    21.7. GIVEN a handler that keeps failing WHEN 2 retries run out THEN the message goes to `<queue>-dlq` AND the `messaging.dead_lettered` counter grows by 1 with the message type and the queue name.
    21.8. GIVEN a message with an unknown type name, no type header, or bad JSON WHEN it arrives THEN it goes to `<queue>-dlq` without retries.
    21.9. GIVEN the broker restarts WHEN the consumer reconnects THEN messages sent after the restart are handled.
    21.10. GIVEN messages in flight WHEN a test waits for catch-up THEN the wait ends when a probe message sent to each queue at the start of the wait has been seen by its consumer.
    21.11. GIVEN a sent message WHEN a consumer receives it THEN the headers have its type name, message id, correlation id, causation id and trace context.

### Workflow delivery

22. Workflows pass messages on reliably, so a purchase continues after failures (Q31, Q32, Q37, Q40).
    22.1. GIVEN the broker is down WHEN a forwarder sends a workflow's output command THEN it retries with back-off AND the workflow processor doesn't stop (Q37, Q65).
    22.2. GIVEN the workflow's `outputHandler` fails after the workflow appended its decision, on PostgreSQL or SQLite, WHEN the application restarts THEN the input is decided once AND the `outputHandler` runs again for the same output (Emmett runs the `outputHandler` as its own step after the decision commits, so its call is at least once) (Q72).
    22.3. GIVEN the setting that delivers a module's own commands through the event store WHEN a worker sends `TimeOutPayment` THEN it is stored straight in the payment workflow's inbox in the payments store; GIVEN the setting for the broker THEN it goes through `payments-internal` and a reader stores it in that inbox (Q40, Q65).
    22.4. GIVEN a module handles a message WHEN its handler appends events THEN their correlation id is the handled message's correlation id AND their causation id is the handled message's id, as Emmett and Almanac set them.
    22.5. GIVEN an outside command (provider answer, warehouse answer, worker command) WHEN it is appended THEN its correlation and causation follow Emmett's and Almanac's rules for the current scope.

### Type names

23. Message types have a module prefix, so two modules can have messages with the same name (Q17, Q29).
    23.1. GIVEN any command or internal event WHEN it is stored or sent THEN its type name is `<module>.<Name>`, with the modules `shopping_carts`, `orders`, `payments` and `shipments`.
    23.2. GIVEN an external event WHEN it is sent THEN its type name is `<module>.external.<Name>`, for example `payments.external.PaymentAuthorized` next to the internal `payments.PaymentAuthorized`.
    23.3. GIVEN an event of an old type name WHEN a processor reads it THEN Emmett's `upcast` in the processor's `messageOptions` gives the current handler the current event (Q54).

### Workers

24. Workers run on an interval, so overdue items close without a person.
    24.1. GIVEN workers are on WHEN the application runs THEN each worker's `handle(now)` runs every minute.
    24.2. GIVEN the application stops WHEN shutdown runs THEN the workers' loop stops through its `AbortSignal`.
    24.3. GIVEN workers are off (tests) WHEN a test step makes time pass THEN the clock moves AND each worker's `handle(now)` runs once.

### Settings

25. An operator chooses a setup through settings, so one application runs in each setup.
    25.1. GIVEN `MESSAGING_BUS=rabbitmq` and `EVENTSTORE_TYPE=postgresql` WHEN the application is built THEN it has the RabbitMQ forwarders and consumers and the PostgreSQL event store; the same holds for `kafka` with `postgresql`, for `in-memory` with `sqlite`, and for `none` with `sqlite`.
    25.2. GIVEN an unknown value, for example `MESSAGING_BUS=sqs` WHEN the application starts THEN it stops with a message naming the setting and the allowed values.
    25.3. GIVEN the SQLite setup and no SQLite folder in the settings WHEN the application starts THEN it creates a new folder in the operating system's temporary folder with one file per module and `broker.db` (Q60) AND needs no Docker AND removes the folder on shutdown.
    25.4. GIVEN a SQLite folder in the settings (`SQLITE_FOLDER`) WHEN the application stops and starts again THEN the carts and orders are still there AND the folder is not removed. A given folder that does not exist is created (Q72).

### Money

26. Prices are numbers in currency units rounded to whole cents, as in Java, so totals add up.
    26.1. GIVEN a cart with 3 of a product at 19.99 WHEN it totals them THEN the total is 59.97, not 59.97000000000001.

### Documentation

27. A developer reads the API and the messages, so they can use and extend the sample.
    27.1. GIVEN the running application WHEN a developer opens the OpenAPI document THEN it has the shopping-cart and order endpoints in two groups, with `x-eventcatalog-message-type` `query` for `GET` and `command` for the rest.
    27.2. GIVEN the running application WHEN a developer opens the AsyncAPI document THEN it has one group per module, with each module's channels, the messages it sends and receives, their descriptions and schemas, servers for Kafka, RabbitMQ and in memory, and `x-eventcatalog-message-type` `command` for commands and `event` for events.
    27.3. GIVEN the OpenAPI and AsyncAPI documents WHEN EventCatalog is generated THEN the site shows the four modules as services, their commands as commands and their events as events, and the channels, AND its Playwright test passes.

### Contract tests

28. A developer changes a message, so the tests show whether old data can still be read.
    28.1. GIVEN a stored event, a sent message or an HTTP body WHEN its serialized form changes THEN its snapshot test fails.
    28.2. GIVEN a message with optional fields WHEN it is serialized with all fields and with only the required ones THEN each form has its own snapshot.
    28.3. GIVEN a snapshot of an `OrderCanceled` without a shipment id WHEN it is read with the current code THEN `shipmentId` is `undefined`.
    28.4. GIVEN a missing snapshot on CI WHEN the tests run THEN they fail.

### Browser

29. A tester drives the shop in a browser, so the pages are tested end to end.
    29.1. GIVEN the SQLite setup WHEN a test buys through the pages with Playwright THEN the order page shows the completed order AND no response failed.
    29.2. GIVEN two tabs WHEN the order changes in one THEN the other shows the change in place.

### Telemetry

30. An operator watches purchases in Grafana, so they see where a purchase is and what failed.
    30.1. GIVEN the application exports to otel-lgtm WHEN a customer buys THEN one trace shows the purchase across the modules and the brokers.
    30.2. GIVEN the running application WHEN an order is paid, sent and completed THEN `ecommerce.order.revenue` records the total, `ecommerce.order.lead.time` records the time per stage (`paid`, `sent`, `completed`), and the gauges `ecommerce.orders.in.progress` and `ecommerce.orders.awaiting.payment` show the counts.
    30.3. GIVEN the application started WHEN no command ran yet THEN Emmett's command and event counters exist at 0 for every command and event type of each module, through the Emmett fix of #433 (Q35).
    30.4. GIVEN the Grafana dashboards WHEN they load THEN every panel query is valid against Emmett's metric names.
    30.5. GIVEN a capture fails for the first time after a start WHEN the alert rule evaluates THEN the "Capture failed" alert fires.
    30.6. GIVEN no OTLP endpoint is reachable WHEN the application runs THEN it logs no connection errors.
    30.7. GIVEN a command from the broker WHEN the workflow decides it THEN the workflow stamps the decision with its own clock, not the sender's (Java behaviour, Q66).

31. Removed: KurrentDB is dropped (Q69).

## Implementation Decisions

### Workspace

- The sample is an npm workspace in `samples/e-commerce` (Q1, Q6) with two packages (Q16): the application, and one core package that knows nothing about the shop. The application imports the core; the core never imports the application.
- The core package holds the forwarders for Kafka, RabbitMQ and the event store, the broker-to-workflow forwarders and broker consumers, the routings and the queue topology, the workers' loop and the handler retries, and the test helpers that Emmett lacks.
- The root scripts (`build:ts`, `fix`, `lint`, `test`) run across both packages, so the repository's completion hook and CI work from the sample folder.
- Node 24.22.1, like the other samples (`.nvmrc`). Vitest as the test runner.
- Emmett changes are prepared in parallel with the sample, each on its own branch from `main` with its own pull request (Q36, Q49): the Hono `ApiE2ESpecification` steps and hooks (Q30, branch `hono_api_e2e_specification_steps`), metric series registered at 0 ([#433](https://github.com/event-driven-io/emmett/issues/433), Q35), and a processor retry policy (Q37). The sample doesn't wait: until a change is released, the core package has the sample's own version of it, and the sample switches to Emmett's when it is released (Q49).

### Modules (application package)

- Module layout as in Java and the repository's guidance: entity, workflow (the cart: its decider and `CommandHandler`), events, commands, configuration and Hono routes at the module root; feature folders such as `getorderstatus`, `pending`, `unpaid`, `authorization`, `capture`, `external`, `sandbox`.
- The cart keeps its decider and Emmett's `CommandHandler`, ported from Java with the same rules; its decider throws `IllegalStateError`, which the API answers with 409. Orders, payments and shipments have workflows whose `decide` and `evolve` are ported from the Java deciders (Q65); they never throw and decide no events for duplicate or late commands.
- Each process is decided by its Emmett workflow (Q65). Customer commands from the API go through Emmett's `WorkflowHandler` with `retry: { onVersionConflict: 2 }`, so a version conflict is retried (3 attempts in all), as Java's `CommandHandler` does.
- A workflow stamps its decisions with its own clock (`now`), whatever path the input came by.
- Read models are Pongo projections that run inline with the append (Q20, Q38): on SQLite with the SQLite store, on PostgreSQL otherwise (Q42).
- Reads with `If-None-Match` wait up to 1 s for a newer version before they answer 304. Lookups of data that another module's message creates (an order right after checkout) retry for up to 1 s before they answer 404, as Java's `ConditionalRead` and `LongPolling` do.
- The ids are URNs, as in Java: the order id is derived from the cart id, the first payment id from the order id, the retried payment id from the order id and the attempt number, and the shipment id from the `referenceId`.
- Money is a number in currency units rounded to whole cents, as in Java (`Math.round(x * 100) / 100`).
- Payments and shipments are generic: they know a `referenceId`, never an order.
- The capture client, the authorization client and the fulfillment client are the `outputHandler`s of the payment and shipment workflows (Q64): each calls the outside service for the workflow's output and returns the service's immediate answer, such as `FailPaymentCapture`, which Emmett stores as the workflow's next input. A later answer (the provider confirming a capture, the warehouse confirming a package) arrives from outside as a message, as in Java. The fulfillment client and the authorization client log the failures and record nothing, as in Java. The stock check is different: when the warehouse can't answer, the stock-check call retries with back-off until it does, like the other workflow calls (Q37, Q67). Logs go through plain pino to stdout (Q41).

### Order workflow

- An Emmett `Workflow` (Q4, Q65) whose state is the order (the Java `OrderDecider` rules become its `decide`; its `evolve` only builds the order's state from the events, as Java's `Order` does); it records the order's events in its own stream, and the read models and the forwarder read them there. The workflow id is the order id: derived from the cart id for `ShoppingCartCheckedOut`, from the `referenceId` for the other external events, and the event's order id for the order's own events.
- Decisions, from the Java `OrderSaga` and `OrderDecider`: `ShoppingCartCheckedOut` → `OrderPlaced` + `AuthorizePayment` + `ReserveStock`; `PaymentAuthorized` → the order's payment-authorized event; `StockReserved` → the order's stock-reserved event (and, with both, `OrderConfirmed` + `RequestFulfillment`); `PackageWasSent` → its event; the order's payment due → `CapturePayment`; `PaymentCaptured`, `PaymentFailed`, `ShipmentFailed` → their order events and, where Java compensates, `CancelPayment` or `ReleaseStock`; the customer's retry → the retried event + `AuthorizePayment`; cancel → `OrderCanceled` + `CancelPayment` if the payment is authorized, `ReleaseStock` if the stock is reserved. The customer's commands from the API (retry, cancel) and the unpaid-orders worker's `CloseUnpaidOrder` are inputs of the order workflow.
- Inputs (Q25, Q45, Q47): the workflow processor runs on the event store consumer with Emmett's `separateInputInboxFromProcessing` mode. Every input, including the order's own events, is first stored in the workflow stream; that is one extra append per input, accepted in Q47. A broker-to-workflow forwarder takes each external event from the orders module's response queues and stores it in the workflow's inbox through `WorkflowHandler`'s store-only path. Without a broker, the sending module's forwarder stores it there directly. The workflow processor handles the inputs one after another.
- Duplicates: Emmett's inbox mode doesn't skip an input it already handled ([emmett#434](https://github.com/event-driven-io/emmett/issues/434), Q43). The handlers are idempotent, so a duplicate output does no harm.
- Payment and shipment workflows (Q44, Q65): the same shape, with the payment or the shipment as state (the Java `PaymentDecider` and `ShipmentDecider` rules become their `decide`; `evolve` only builds the state from the events). Their inputs are the commands from orders and from workers and sandboxes, and the answers of external tools; their `outputHandler` calls the payment gateway or the warehouse (Q64). The stock check is one of those calls: on `ReserveStock` the shipment workflow asks the warehouse through its `outputHandler`, and decides `StockReserved` or `ProductWasOutOfStock` from the answer that comes back as its next input (Q67).
- Outputs (Q65): a forwarder reads the order workflow's recorded output commands for other modules (`AuthorizePayment`, `CapturePayment`, `CancelPayment`, `ReserveStock`, `RequestFulfillment`, `ReleaseStock`) from its stream and sends them with the defined routings, then saves its checkpoint, the same way external events are forwarded. They reach the payment or shipment workflow's inbox, and that workflow decides on them.

### Core package

- **Routings**: one list of routings maps each message type to a channel and a routing key, with the Java `MessageRouter` rules: the first matching rule that gives a channel wins, the first that gives a key wins. The same list declares the channels and the queues (a queue binds to a channel with a topic pattern). Forwarders and the topology setup use it.
- **Forwarder**: an Emmett reactor on the event store consumer whose `eachMessage` handler maps an internal event to its external form where a module defines one, sends the result with the routings, and then the reactor saves its checkpoint (Q22, Q57). All messages mapped from one recorded message are routed before any is sent. One forwarder handler per broker: Kafka, RabbitMQ, channel streams. Messages are Emmett messages with Emmett metadata; there is no message bus, send target or message shape of the sample's own. Delivery is at least once. On any failure the forwarder retries with exponential back-off inside its handler, without a limit (Q24, Q37).
- **Kafka** on `@platformatic/kafka` (Q5), with the Java topology: a topic per channel with 3 partitions; a queue bound with `#` is a consumer group (group id = queue name) on the channel topic; a queue with another pattern gets its own topic, filled by a routing consumer; the record key is the routing key; offsets committed after handling; dead-letter topic `<queue>-dlt`; a send waits for the acknowledgement up to the publish timeout.
- **RabbitMQ** on `amqplib` (Q33), with the Java topology: a durable topic exchange per channel; a durable quorum queue per queue with dead-letter exchange `<queue>-dlx` and dead-letter queue `<queue>-dlq`; publisher confirms; mandatory sends on `-requests` and `-internal` channels.
- **Channels as streams** (`MESSAGING_BUS=in-memory`, Q51, Q55, Q60): each channel is a stream `channel:<name>`. A module's `-internal` channel lives in the module's own store; the channels between modules live in a dedicated broker database (`broker.db` on SQLite, a `broker` schema on PostgreSQL). A forwarder is the `eachMessage` handler of an Emmett reactor on the event store consumer, and it appends to the channel stream with the routing key in the metadata. A reader is a reactor on the same consumer with `canHandle` set to its types; it handles a message only when it comes from the channel stream and its key matches the binding key, and it skips the copy in the source stream, such as a workflow's outbox. A failing reader retries as the consumers do (configurable, 2 retries by default) and then appends the message to `channel:<queue>-dlq`. `MESSAGING_INTERNAL_DELIVERY=broker` then uses these channel streams, so both delivery settings work in every setup. Nothing runs another module's handlers inside a forwarder's processing (Q47).
- **No broker** (`MESSAGING_BUS=none`, Q60): no channels between modules. A forwarder appends each message to a channel stream in the receiving module's own store, and the receiver's channel reactor stores it in its workflow inbox with `WorkflowHandler`'s store-only path (Q45, Q62). A module's own commands go through its own store, as with `MESSAGING_INTERNAL_DELIVERY=store`. Delivery between modules is at least once in every setting, because the sender's checkpoint and the write into another database are not one transaction; message ids and idempotent handlers deal with duplicates (Q43).
- **Consumers**: Kafka and RabbitMQ consumers are Emmett consumers (Emmett's `consumer` with a `MessageSource` built on `subscriptionMessageSource`), so they register reactors and workflow processors the same way as the event store consumers (Q57). A reactor on a queue stores each message in the receiving workflow's inbox (Q45), or stores a module's own command in its workflow inbox (Q40, Q65). Retry: exponential back-off from the initial interval, with a configurable number of retries, 2 by default as in Java's `RetryBackOff`; messages that can't be read skip retries; then dead letters and the `messaging.dead_lettered` counter.
- **Headers** carry the type name, the message id, the correlation id, the causation id and the trace context. Correlation and causation follow Emmett's and Almanac's rules (Q31): the correlation id comes from the observability scope or the handled message's metadata, and the causation id is the handled message's id.
- **Message ids**: a recorded message keeps its id when sent. An external event mapped from an internal one gets an id derived from the internal event's id and the external type name.
- **Commands a module sends to itself** (Q22 a, Q40, Q65): workers and sandboxes send each command as an input of the workflow of its order, payment or shipment. A setting chooses whether it is stored straight in that workflow's inbox in the module's own store, or travels over the module's `-internal` channel and a reader stores it there. The workflow decides on it; nothing passes it on.
- **Workers' loop**: calls each worker's `handle(now)` every minute, waiting with Emmett's `delayOrAbort` between runs (the ESLint setup forbids `node:*` imports in production code), stopped through an `AbortSignal` on shutdown.
- **Catch-up**: for each broker, a wait until every queue has handled what was sent before the wait started (Kafka: committed offsets against end offsets; RabbitMQ: a probe message per queue; without a broker: nothing to wait for), plus Emmett's consumer catch-up for the store.
- **Type names** (Q17, Q29): `<module>.<Name>` and `<module>.external.<Name>`, with the modules `shopping_carts`, `orders`, `payments`, `shipments`.
- **Retries** (Q37): forwarders retry with exponential back-off inside their handlers, so a broker outage doesn't stop them. Emmett gets a processor retry policy on its own branch; the sample keeps its handler retries until then.

### Event stores

- **One database per module** (Q60): cart, orders, payments and shipments each have their own event store and their own read models: a SQLite file each, a PostgreSQL schema each in one database. Every stream name starts with its module: `{module}_{streamtype}-{id}`, for example `orders_order-42` or `shopping_carts_cart-<id>`. Streams use this name in every store, and Emmett's workflow streams are mapped to it with `mapWorkflowId` (`orders_workflow-<orderId>`). A module never reads another module's database.
- SQLite setup (Q19, Q21, Q60): `emmett-sqlite` with its consumer, one file per module (`<module>.db`) plus `broker.db` for the channels between modules. The folder for these files comes from the settings; without one, the application creates a new folder in the operating system's temporary folder at start and removes it on shutdown. A folder from the settings is never removed. A plain `:memory:` is not used, because the store, its consumer and Pongo open more than one connection.
- Kafka + PostgreSQL: `emmett-postgresql`.
- RabbitMQ + PostgreSQL: `emmett-postgresql`.

### Telemetry

- Emmett's observability through Almanac with the OpenTelemetry provider (Q18). Traces, metrics and logs go over OTLP to `grafana/otel-lgtm`, which Docker Compose runs with `GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false`, as in Java.
- The command, event and processor metrics are Emmett's (for example `emmett.command.handling.duration`). The dashboards and alerts use those names, and the counters start at 0 through the Emmett fix of #433 (Q35).
- The sample adds the trace context in broker headers, so a trace continues across Kafka and RabbitMQ, and the business metrics from Java (`ecommerce.order.revenue`, `ecommerce.order.lead.time` per stage, the gauges `ecommerce.orders.in.progress` and `ecommerce.orders.awaiting.payment`).

### Settings

- Environment variables named after the Java settings: `MESSAGING_BUS` (`in-memory`, `none`, `kafka`, `rabbitmq`; default `kafka`), `EVENTSTORE_TYPE` (`sqlite`, `postgresql`; default `postgresql`), `WORKERS_SCHEDULED` (default `true`; tests set `false`), `MESSAGING_KAFKA_PUBLISH_TIMEOUT` and `MESSAGING_RABBITMQ_PUBLISH_TIMEOUT` (default `10s`), `MESSAGING_RETRY_INITIAL_INTERVAL` (default `1s`), `SHOP_GRAFANA_URL` (default `http://localhost:3000`), `SHOP_EVENTCATALOG_URL` (default `http://localhost:3001`), `SQLITE_FOLDER` (no default: a temporary folder with one file per module and `broker.db`, Q60), and `MESSAGING_INTERNAL_DELIVERY` (`store`, `broker`; default `broker`) for a module's own commands (Q40; Java has no such setting and always uses its `-internal` channels). Connection settings, after the Java ones: `POSTGRESQL_URL`, `KAFKA_BOOTSTRAP_SERVERS`, `RABBITMQ_URL`, and the standard `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`, Q73). The bus and event store settings are independent; any pair works (Q42). An unknown value stops the start with a message naming the setting and the allowed values.

### Web

- Hono with Emmett's `emmett-honojs` (Q2): ETag helpers and problem details. The errors map as in Java: version conflict 412, illegal state 409, not found 404, bad input 400, gateway failure 502.
- Pages use `hono/jsx` and htmx 4 (`htmx.org@4.0.2`).

### Documentation

- OpenAPI from Zod schemas of the request and response bodies with `@hono/zod-openapi` (Q33).
- AsyncAPI built in TypeScript from the routings and the messages' Zod schemas, with one group per module and `x-eventcatalog-message-type` on each message, and checked with `@asyncapi/parser`.
- EventCatalog generated from both documents, with a Playwright test against the generated site, as in Java.
- UIs (Q39): Swagger UI (`@hono/swagger-ui`) for OpenAPI; the AsyncAPI React component (`@asyncapi/react-component`) on a page for AsyncAPI, plus a small page that sends a message to the application, like Springwolf's Publish button.

## Testing Decisions

Good tests check behaviour that a caller can see, through the same entry points that calling code uses, written as Given / When / Then, and named after the behaviour (Q11). Assertions use Vitest `expect` (Q33).

- **Application black box**: Emmett's Hono `ApiE2ESpecification`, extended (Q30; built in the core package first and in Emmett in parallel, Q49) to take steps for HTTP requests, messages from the broker, time passing (moves the clock and runs the workers once) and attempts (a given request allowed to fail), with hooks to start and stop consumers and workers, and with the expectations `expectResponse`, `expectError`, `expectPublished`, `expectNothingPublished`, `expectAppended`, `expectNothingAppended`, `htmlContaining`, `htmlNotContaining` and `redirectsTo`. After each step it waits for the store and the broker, and repeats until a round sends nothing new, as Java does. Given requests keep Emmett's behaviour; tests check failures with error status and problem details expectations (Q50). Each module has one API test file with one nested `describe` per endpoint, and its requests in a file named after the module. A module test sets up only through its own requests and the messages it receives. In Emmett's version the appended-events checks are named `expectNewEvents` and `expectNoNewEvents`; they check exactly the streams and event counts the `when` step appended, in any stream order, and given steps can also be event streams ([emmett#436](https://github.com/event-driven-io/emmett/issues/436), Q58). The sample renames its `expectAppended` and `expectNothingAppended` when it switches to Emmett's version (Q49). Prior art: the Java `ApiE2ESpecification`, `OrdersApiTests`, `PaymentsApiTests`.
- **Purchases across modules**: one set of purchase scenarios that runs on each of the three setups.
- **Browser**: a browser specification on top of the black box, with the Playwright library inside Vitest (Q33). Prior art: the Java `BrowserE2ESpecification`.
- **Core package** (Q32): one shared test suite for forwarders and consumers run on Kafka, RabbitMQ and the event store, plus failure, retry, dead-letter, restart and catch-up tests for Kafka and RabbitMQ, the headers and the dead-letter counter, routing, the outbox streams, the workers' loop and the counters at zero, all through the core's public contract. Prior art: the Java `MessageBusTests`, `KafkaMessageBusFailureTests`, `RabbitMQMessageBusRestartTests`, `MessageRouterTests`.
- **Decisions**: the cart's decider is tested with Emmett's `DeciderSpecification`; the order, payment and shipment workflows with Emmett's `WorkflowSpecification`, one test file per workflow (Q65). Prior art: the Java `OrderTests`.
- **Contract snapshots**: Vitest `toMatchFileSnapshot` of every stored event, sent message and HTTP body, with all fields and with only the required fields where they differ, plus backward-compatibility tests that read an old snapshot with the current code (Q7). On CI, a missing snapshot fails.
- **Fakes** implement the real ports and are named after what they do, with steps that script them: a payment provider (`isUnreachableFor`, `refusesTheFirstCaptureOf`, ...), a warehouse (`isOutOf`, `rejectsTheRequest`, ...), changeable prices, and a clock. No mocking library.
- **Real infrastructure** through Testcontainers (Q33): PostgreSQL through `emmett-testcontainers`, `@testcontainers/kafka` and `@testcontainers/rabbitmq`. Each test uses new ids, so tests share one database without cleaning it up.

## Out of Scope

- Telemetry tests (Q9): trace, causation and metric expectations on `ApiE2ESpecification`, the Grafana LGTM export tests (with a `GenericContainer` for otel-lgtm) and the Grafana API helper. They come in a follow-up spec. The telemetry itself is in this spec (Q18); scenarios 30.1, 30.2, 30.4 and 30.5 get their automated tests in the follow-up. The headers, causation and the dead-letter counter (20.7, 20.11, 21.7, 21.11, 22.4, 22.5), the counters at zero (30.3, through Emmett) and the no-OTLP-endpoint test (30.6, Q46) are tested in this spec.
- Moving the core package's parts to Emmett (Q6). That is a follow-up after the sample works. The change to Emmett's Hono `ApiE2ESpecification` is not part of this follow-up; it comes first (Q30).
- A Node.js port of Strictland (Q7).
- What the Java sample also leaves out: real sign-in, webhook endpoints, anonymous carts, partial reservations, returns and refunds.

## Further Notes

- Research and sources: [README.md](README.md), [research/java-sample-inventory.md](research/java-sample-inventory.md), [research/emmett-inventory.md](research/emmett-inventory.md), [research/nodejs-tools.md](research/nodejs-tools.md).
- Emmett issues the sample touches: appends from a reactor skipping inline projections ([#432](https://github.com/event-driven-io/emmett/issues/432); until it is fixed, the tests whose read models depend on processor appends are marked as expected failures, Q66), counters at zero ([#433](https://github.com/event-driven-io/emmett/issues/433), fixed in Emmett, Q35), inbox duplicates ([#434](https://github.com/event-driven-io/emmett/issues/434), Q43), `emmett-testcontainers` packaging ([#384](https://github.com/event-driven-io/emmett/issues/384)).
- Reviews: [r2](reviews/20261123T170342_spec_r2_review.md), [r3](reviews/20261123T173151_spec_r3_review.md).
