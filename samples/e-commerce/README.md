[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/oskardudycz/) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_nodejs) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_nodejs)

![Github Actions](https://github.com/oskardudycz/EventSourcing.NodeJS/actions/workflows/samples_e_commerce.yml/badge.svg?branch=main)

# Distributed process with compensation: an online shop with Event Sourcing

- [Distributed process with compensation: an online shop with Event Sourcing](#distributed-process-with-compensation-an-online-shop-with-event-sourcing)
  - [Cross-module processes with compensation](#cross-module-processes-with-compensation)
    - [A purchase, from the customer's side](#a-purchase-from-the-customers-side)
    - [Reserve first, charge last](#reserve-first-charge-last)
    - [Where the steps come from](#where-the-steps-come-from)
    - [The whole purchase](#the-whole-purchase)
    - [The order decides](#the-order-decides)
    - [When a step fails](#when-a-step-fails)
    - [Messages between modules](#messages-between-modules)
    - [Delivering messages reliably](#delivering-messages-reliably)
    - [The payment provider and the fulfillment service](#the-payment-provider-and-the-fulfillment-service)
    - [The web API and the shop](#the-web-api-and-the-shop)
    - [Running the application](#running-the-application)
    - [Testing the application](#testing-the-application)
    - [Seeing what happens: traces, metrics and logs](#seeing-what-happens-traces-metrics-and-logs)
    - [Documenting the messages](#documenting-the-messages)
    - [Where the code lives](#where-the-code-lives)
    - [Known issues](#known-issues)
    - [What this sample doesn't cover](#what-this-sample-doesnt-cover)

This sample shows how to handle distributed processes with Event Sourcing. For more background, check my articles [Saga and Process Manager - distributed processes in practice](https://event-driven.io/en/saga_process_manager_distributed_transactions?utm_source=event_sourcing_nodejs) and [No, it can never happen!](https://event-driven.io/en/no_it_can_never_happen/?utm_source=event_sourcing_nodejs).

An event-driven distributed process accepts that one transaction across modules and databases, a _two-phase commit_, is not possible. Instead of one big transaction, it runs a sequence of _microtransactions_. Each operation is handled by the module that's the source of truth and can make autonomous decisions. An event recorded and published in the system starts the process, e.g. shopping cart checked out. Then another module can subscribe to it and take it from there. It knows what should be the next operation, e.g. initiating the order process. It sends a command that is handled, and business logic creates another event. This event is the trigger for the next step of the workflow. Such _lasagne_ of event/command/event/command continues until the process is finished (with success or failure).

![lasagne](./assets/lasagne.png)

The sample shows:

- a purchase in an online shop, where a later step can fail after earlier steps have finished, and the finished steps have to be undone;
- how modules send each other commands and events, and why each module keeps the events it shares apart from its own;
- how to deliver messages without losing them when the application crashes, and without breaking anything when a message arrives twice;
- a web API and shop pages that read views updated after each write, and that don't show the customer an error while a view catches up;
- how to test the whole application from the outside, through its web API, its messages and its pages;
- how to follow one purchase across the modules with traces, metrics and logs, and how to watch the shop with dashboards and alerts;
- how to document the messages, so that other teams can find and use them.

To try the purchase yourself, follow [HOWTO.md](./HOWTO.md). It takes you through the shop, the web API, the messages, the catalog and Grafana, step by step, with screenshots.

## Cross-module processes with compensation

The [group checkout of hotel guests](../hotelManagement/README.md) undoes nothing. If the checkout of one guest fails, the other checkouts stay done, and you can run the group checkout again after you fix the problem. A purchase can't work that way. If the shop can't send the goods, it has to cancel the customer's payment. If the customer doesn't pay, the shop has to put the goods it set aside back on sale. Undoing the steps that already happened is called _compensation_.

The e-commerce sample shows such a process. One purchase goes through four modules: [shopping carts](./packages/application/src/shoppingCarts/), [orders](./packages/application/src/orders/), [payments](./packages/application/src/payments/) and [shipments](./packages/application/src/shipments/). The modules run in one Node.js application, built on [Emmett](https://github.com/event-driven-io/emmett). Each module has its own data, and the modules talk only through messages.

A message is a command or an event. A _command_ asks a module to do something, such as `CapturePayment`. The module decides, and it can ignore the command. An _event_ records something that already happened, such as `PaymentCaptured`.

The modules use Event Sourcing: they store every change as an event, in an _event store_, instead of storing the current state. Each module has its own event store, in its own database. The state is a plain object, such as `Order` or `Payment`, and its `evolve` function applies one event to it. Each entity's events form one _stream_, an ordered list, and adding events to it is called _appending_.

The shopping cart keeps its business rules in a _decider_: a `decide` function that takes a command and the current state, checks the rules and returns the new events. Emmett's `CommandHandler` reads the cart's stream, rebuilds the state from its events with `evolve`, calls `decide` and appends the events that it returns. Orders, payments and shipments run a process, so each of them is an Emmett _workflow_: a `decide` function that takes an _input_, a command or another module's event, and returns the module's events and the commands for the other modules, its _outputs_. Emmett's `WorkflowHandler` stores the input, rebuilds the state, calls `decide` and appends the outputs, in one append to the workflow's stream.

### A purchase, from the customer's side

The customer logs in, adds products to the cart and clicks **Check out**. The shop shows the new order, which waits for the payment:

![The order waits for the payment](./assets/howto/4-order-awaiting-payment.png)

The customer clicks **Pay now**, and the shop sends them to the payment provider's page, as Stripe or Adyen do. In the sample, a _sandbox_ plays the payment provider: a small stand-in, built into the application, that shows a page like Stripe's and accepts Stripe's test cards.

![The payment provider's page](./assets/howto/5-sandbox-checkout.png)

After the payment, the provider sends the customer back to the shop, and the order shows **Processing**: it waits for the warehouse. A second sandbox plays the warehouse, with its own page, where a person sends the package or rejects it, and marks products out of stock:

![The sandbox warehouse page](./assets/howto/6-sandbox-warehouse.png)

Once the package is sent, the customer is charged, and the order page updates to **Completed**, with a carrier and a tracking number:

![The completed order](./assets/howto/6-order-completed.png)

The customer saw three pages. Behind them, more than fifteen messages went between the modules: the cart told the orders module about the checkout, the orders module asked the payments module for a payment and the shipments module for the products, each of them answered, and so on until the order completed. The rest of this part explains those messages: what they are, why the process needs each of them, and how the modules handle them when something fails.

### Reserve first, charge last

A purchase needs two things: the customer's money and the goods. They are in two separate systems: the money at the payment provider, the goods in the warehouse. No single transaction covers both. So the shop can't take both at once, and if one step fails, nothing undoes the other step automatically.

Shops solve this in two steps. First, they reserve both, without taking either:

- the customer _authorizes_ the payment on the provider's page. The provider checks that the customer can pay and keeps the amount for the shop, but doesn't charge the customer yet;
- the warehouse _reserves_ the products: it sets them aside for the order, so that nobody else can buy them.

Only when both reservations are in place does the shop take what it reserved: the warehouse sends the package, and the shop _charges_ the customer. The payment providers call the charge a _capture_.

```
authorize the payment ──┐
                        ├──> both reserved ──> send the package ──> charge the customer
reserve the products  ──┘
```

The two reservations end differently. An authorization lasts only for a limited time. For online card payments, [Stripe](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) keeps an authorization for 7 days on the major card networks. If it expires before the capture, the funds are released and the payment becomes `canceled`. So the customer is never charged for an order that the shop forgot. For the shop, the expiry is a deadline: it has to charge before it. The reserved products have no timer. Shopify calls them **committed**: "units that are part of a placed order but aren't yet fulfilled". They stay committed until the order ships or is canceled.

The charge comes last on purpose. Shops that sell physical goods charge when the goods leave, not when the order is placed: Amazon charges the card when the item ships, and Shopify can charge when the order is fulfilled, that is, sent. So the customer is never charged for something that didn't ship. And an order that fails before the package leaves only has to release its two reservations. Nobody was charged, so there is nothing to refund. A payment that fails after the package left is a different case, described in [When a step fails](#when-a-step-fails).

### Where the steps come from

The names in the sample come from the providers' own documentation. Each command matches an operation of a real provider, or a _webhook_: an HTTP call from the provider to the shop, and each state is one that a provider reports, so you can compare the diagrams below with their docs. The sources are collected in the Java sample's [real-world-flow.md](https://github.com/oskardudycz/EventSourcing.JVM/blob/main/samples/e-commerce/plans/saga-and-outbox/real-world-flow.md).

**The cart.** The workshops in this repository start a cart with an `OpenShoppingCart` command. Real shops have no such step: in Shopify, WooCommerce, Amazon and Allegro, the first "Add to cart" starts the cart, so the first event in a cart's stream is `ProductItemAddedToShoppingCart`. The sample assumes that the customer is logged in, as on Allegro, where buying needs an account. Each cart is a short stream, `shopping_carts_cart-{customerId}-{n}`. A customer has at most one open cart, and the first product after a checkout starts cart `n + 1`. The [customerShoppingCarts](./packages/application/src/shoppingCarts/currentCart/customerShoppingCarts.ts) _projection_ knows which cart is the current one. A projection is a read model, like a table kept for queries, that a module builds from its events and updates with each new one. This README also calls it a _view_. If two requests start the same new cart, the slower append finds the stream already there. It then retries, as described in [The order decides](#the-order-decides), and adds the product to the cart that the other request started.

The customer chooses a product and a quantity, never a price. The price list gives the price when the product first enters the cart, and a later add of the same product keeps the line's price. The cart does not promise that price. Amazon's [cart](https://us.amazon.com/gp/cart/view.html) "reflects each item's most recent price", and Shopify's checkout can say ["Prices for these items have changed and are updated in your cart"](https://community.shopify.com/t/prices-for-these-items-have-changed-and-are-updated-in-your-cart/284837). So `CheckOutShoppingCart` reads the current prices. If one changed, the cart records `ProductItemPriceChanged` and stays open. Each change gives the cart a new version, and a checkout carries the version that the customer saw. So after a price change, the customer has to look at the new prices and check out again. If no price changed, the cart records `ShoppingCartCheckedOut`. The name is the one the shops use: "Proceed to checkout" on Amazon and WooCommerce, "Check out" on Shopify, "Go to checkout" on Allegro. No shop has a "cancel cart" action, so the sample has none: a customer leaves the cart, and nothing happens.

A price can still change between the check and the append. The shops accept that: the price at the click is the price of the order. On Allegro, [the price stays as it was when the customer clicked "Buy now"](https://spolecznosc.allegro.pl/t5/dyskusje-kupuj%C4%85cych/pytanie/m-p/705830). Amazon handles a wrong price after the order, by its [terms of sale](https://www.pinsentmasons.com/out-law/guides/amazons-pricing-error): it may contact the buyer or cancel. Locking the price list during checkout would need one transaction across pricing and the cart, which is the two-phase commit this sample avoids.

**The payment.** Payment providers keep authorizing and charging as two separate steps. Stripe calls this [place a hold on a payment method](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) and switches it on with `capture_method: manual`. Adyen calls the second step [capture](https://docs.adyen.com/online-payments/capture) and supports delaying it. Both let the shop cancel an authorized payment before the customer is charged: Stripe calls it canceling the PaymentIntent, its object for one payment, and this sample calls it `CancelPayment`. Stripe's payment page for one payment is a _Checkout Session_, described in **The payment page** below.

```mermaid
stateDiagram-v2
    [*] --> Pending: AuthorizePayment
    Pending --> Pending: CreateCheckoutSession (the customer opens the payment page)
    Pending --> Authorized: ConfirmPaymentAuthorization
    Pending --> Failed: TimeOutPayment
    Authorized --> CaptureRequested: CapturePayment
    Authorized --> Canceled: CancelPayment
    Authorized --> Failed: ExpirePaymentAuthorization
    CaptureRequested --> Captured: ConfirmPaymentCapture
    CaptureRequested --> Failed: FailPaymentCapture
    Captured --> [*]
    Canceled --> [*]
    Failed --> [*]
```

| Ours                          | Stripe                                                                        | Adyen                       |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------- |
| `CreateCheckoutSession`       | create a Checkout Session with `capture_method: manual`                       | create a payment session    |
| `ConfirmPaymentAuthorization` | the `payment_intent.amount_capturable_updated` webhook, with `capture_before` | the `AUTHORISATION` webhook |
| `TimeOutPayment`              | expire the Checkout Session                                                   | no such operation           |
| `CapturePayment`              | capture the PaymentIntent                                                     | capture                     |
| `CancelPayment`               | cancel the PaymentIntent                                                      | cancel                      |
| `ExpirePaymentAuthorization`  | the authorization lapses and the funds are released                           | the transaction expires     |

There's no single answer to how long an authorization lasts. Stripe lists around 7 days for online card payments, and [Adyen's table for each card network](https://docs.adyen.com/online-payments/adjust-authorisation) shows the spread: Mastercard 7 days for a final authorization and 30 for a pre-authorization, Visa 5 to 30 depending on the kind of shop, JCB up to a year. That's why the provider's answer brings the deadline, Stripe's `capture_before`, and `captureBefore` travels on the event. The payments module records the deadline that the provider gave, instead of a number that isn't true for every card.

**The payment page.** Only the customer can authorize a payment: with 3-D Secure (an extra confirmation of a card payment), BLIK (a Polish mobile payment code) or a transfer, on the provider's own page. When the customer clicks "Pay", the shop asks the provider for a payment page and sends the customer there with an HTTP 303 redirect: Stripe's [Checkout Session](https://docs.stripe.com/checkout/quickstart), Adyen's payment session, PayPal's order with its `payer-action` link. The provider sends the customer back to the shop's page, but that return decides nothing. Stripe says ["you can't rely on triggering fulfillment only from your checkout landing page"](https://docs.stripe.com/checkout/fulfillment?ui=full-page), because the customer can lose the connection before the page loads. The outcome comes in a webhook.

Allegro shows how that looks to the customer. After "Buy and pay", Allegro [redirects the customer to a page where the payment is completed](https://allegro.pl/pomoc/dla-kupujacych/przelew-bankowy/jak-zaplacic-za-przedmiot-kupiony-na-allegro-YLKol7RVxI0). Back on Allegro, "My purchases" shows "Your payment is being processed" until the payment is settled. A customer who closes the page without paying can cancel the payment, and the purchase is then marked unpaid. "Pay" pays it later, and "Retry payment" retries a failed payment.

The sample follows Stripe. `AuthorizePayment` only records that the payment waits for the customer. "Pay now" on the order status page calls [paymentCheckoutSessions](./packages/application/src/payments/paymentCheckoutSessions.ts): the payments module asks the provider for a Checkout Session that expires in 30 minutes, and records `CheckoutSessionCreated` with the session's URL and expiry. The payment can be a moment behind the order, because `AuthorizePayment` goes through the message bus, so "Pay now" waits up to a second for it. A second click before the expiry gets the same page, so one payment can never be authorized twice. After the expiry, the next click creates a new session for the same payment, as Stripe's recovery link for an expired session does. A new payment comes only from "Retry payment". The provider's webhook answers with `ConfirmPaymentAuthorization`, carrying `captureBefore`. A declined card is not an answer: Stripe's page shows the decline, and the customer tries again on the same page. A customer who never pays is timed out when the time for the payment runs out (`timesOutAt`, 24 hours in the running application).

**The products.** The cart reserves nothing: on Allegro, putting a product in the cart [does not reserve it](https://spolecznosc.allegro.pl/t5/dyskusje-kupuj%C4%85cych/zmiana-cen-po-dodaniu-do-koszyka/td-p/657648). Placing the order reserves the products. Shopify's [inventory states](https://help.shopify.com/en/manual/products/inventory/managing-inventory-quantities/inventory-states) separate _available_ from _committed_, and placing an order moves units from one to the other. WooCommerce [creates the order when the customer clicks "Place order"](https://wordpress.org/support/?p=10149006), before the payment, and reserves its products. WooCommerce's "Hold stock (minutes)" is a timer on the unpaid order: [when it runs out, the order is canceled and the products go back on sale](https://www.businessbloomer.com/woocommerce-automatically-cancel-orders/). The sample does the same with the order's `dueAt`: an order still unpaid at that date is canceled, and its products are released.

Sending the package is a request to a fulfillment service, the company that runs the warehouse, which answers later. Shopify's [fulfillment request](https://help.shopify.com/en/manual/fulfillment/fulfilling-orders/app-fulfillment) is accepted or rejected by the service. This sample has no merchant step after a rejection, so a rejected request cancels the order.

```mermaid
stateDiagram-v2
    [*] --> Reserved: ReserveStock
    [*] --> ProductsOutOfStock: ReserveStock (not everything is available)
    Reserved --> FulfillmentRequested: RequestFulfillment (only once the order is confirmed)
    Reserved --> Released: ReleaseStock
    FulfillmentRequested --> Sent: ConfirmPackageSent
    FulfillmentRequested --> FulfillmentRejected: RejectFulfillment
    FulfillmentRequested --> Released: ReleaseStock
    FulfillmentRejected --> Released: ReleaseStock
    Sent --> Delivered: DeliverPackage
    Delivered --> [*]
    Released --> [*]
    ProductsOutOfStock --> [*]
```

Both diagrams have the same shape: a reservation, a step that takes what was reserved, and a way to release the reservation.

### The whole purchase

The diagram below shows the messages of one purchase. The order workflow, in the orders module, connects the modules: it takes their events as inputs and sends them commands as outputs. _External_ marks an event that a module publishes for the other modules, as described in [Internal and external events](#internal-and-external-events).

```mermaid
sequenceDiagram
    participant Customer
    participant Cart as ShoppingCarts
    participant Order as Order workflow
    participant Pay as Payments
    participant Ship as Shipments

    Customer->>Cart: CheckOutShoppingCart
    Cart->>Order: ShoppingCartCheckedOut (external)
    Note over Order: decides OrderPlaced

    par payment
        Order->>Pay: AuthorizePayment
        Customer->>Pay: CreateCheckoutSession ("Pay now" on the order status page)
        Pay-->>Customer: 303 to the provider's payment page
        Note over Customer: pays on the provider's page, then comes back to the order status page
        Pay->>Pay: the provider's webhook answers with ConfirmPaymentAuthorization
        Pay->>Order: PaymentAuthorized (external)
        Note over Order: decides OrderPaymentAuthorized
    and products
        Order->>Ship: ReserveStock
        Ship->>Ship: the warehouse answers the stock check with ConfirmStockAvailability
        Ship->>Order: StockReserved (external)
        Note over Order: decides OrderStockReserved
    end

    Note over Order: the second reservation to arrive confirms the order: OrderConfirmed

    Order->>Ship: RequestFulfillment
    Ship->>Ship: the fulfillment service answers with ConfirmPackageSent
    Ship->>Order: PackageWasSent (external, carries the carrier and the tracking number)
    Note over Order: decides OrderPackageSent and OrderPaymentDue
    Order->>Pay: CapturePayment
    Pay->>Pay: the provider confirms the charge
    Pay->>Order: PaymentCaptured (external)

    Note over Order: sent and charged, so the order completes: OrderCompleted
```

The order completes once the package was sent and the customer was charged, which is what Shopify and commercetools call fulfilled and paid. Neither waits for the delivery. The shipment still records `PackageWasDelivered`, but nothing outside it reacts. The goods move before the money does: `PaymentCaptured` completes the order only once the package was sent, and `PackageWasSent` counts only while the payment is still authorized, so nothing leaves the warehouse after the authorization expired.

### The order decides

The process lives in one place: the [order workflow](./packages/application/src/orders/orderWorkflow.ts). Its `decide` function knows where the payment and the shipment stand, and it decides when the order is confirmed, completed or canceled, and which commands the other modules get. This section explains it.

`Order` holds one status for the payment and one for the shipment, just as the [hotel sample's](../hotelManagement/README.md) group checkout holds one status for each guest stay:

| Participant | Statuses                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| payment     | `Pending` → `Authorized` → `Captured` (only after `Sent`), or `Failed`; paying again goes from `Failed` to `Retrying` and then `Authorized`, before the confirmation or after `Sent` |
| shipment    | `Pending` → `Reserved` → `Sent`, or `Failed` (out of stock), or `Rejected` (the products are still reserved)                                                                         |

The order itself goes through these statuses:

```mermaid
stateDiagram-v2
    [*] --> Opened: ShoppingCartCheckedOut
    Opened --> Confirmed: both reservations recorded
    Opened --> Canceled: a shipment failure, CancelOrder, or CloseUnpaidOrder at dueAt
    Confirmed --> Completed: package sent and customer charged
    Confirmed --> Canceled: the fulfillment service rejects the request, or the authorization expires before the package is sent
    Confirmed --> ClosedUnpaid: CloseUnpaidOrder at dueAt, after the package was sent
    Completed --> [*]
    Canceled --> [*]
    ClosedUnpaid --> [*]
```

The input that completes a step decides a second event in the same append: `OrderConfirmed` once both reservations are in, `OrderCompleted` once the customer is charged after the package was sent, and `OrderCanceled` when a failure ends the order. `PackageWasSent` also decides `OrderPaymentDue`, which names the payment to charge. There's no `CompleteOrder` or `ConfirmOrder` command, because only the order knows when it moved on.

Every decision is idempotent: an input that arrives twice, or too late, decides no events, so nothing is appended.

```typescript
case 'payments.external.PaymentAuthorized': {
  const { referenceId: orderId, paymentId, authorizedAt } = input.data;
  const authorized: OrderEvent = {
    type: 'orders.OrderPaymentAuthorized',
    data: { orderId, paymentId, authorizedAt },
  };

  if (order.status === 'Opened' && order.payment === 'Pending')
    return withProgress(order, authorizedAt, authorized);

  if (order.payment !== 'Retrying' || paymentId !== order.paymentId)
    return [];

  // ... the authorization of a payment made again, see "Paying again" below
}
```

Idempotency also keeps the process moving. A handler that throws inside an asynchronous process blocks it: the message is delivered again, fails again, and the messages behind it wait. So the workflows of orders, payments and shipments never throw: an input they can't use decides nothing. The shopping cart still throws, because its commands come from a person over HTTP, where a rejected action has to reach the caller as an error. The order also gets two commands from a person, `CancelOrder` and `RetryOrderPayment`, but it ignores them too, because the same order is in the middle of the process. The web API answers both with 202 Accepted, and the customer sees the result on the order page.

Two handlers can also append to the same stream at the same moment. `WorkflowHandler` reads the stream, folds it into the current state with `evolve`, lets the workflow decide, and appends only if the stream is still at the version it read. Otherwise the append fails with a conflict, and the handler reads the stream again and decides again, up to two more times (`retry: { onVersionConflict: 2 }`). That is safe because the decisions are idempotent. A cart command from a person carries the version that the person saw, the _expected version_, so its conflict is not retried. It goes back to the caller.

The workflow's outputs come from the events it decided, not from the input alone. That matters, because an input doesn't always carry what the next command needs. `PackageWasSent` doesn't know which payment to charge, and it shouldn't: the shipments module has never heard of a payment. But the order's state knows it, so the workflow decides `OrderPaymentDue` with the `paymentId`, and sends the charge from that event:

```typescript
case 'orders.OrderPaymentDue':
  return [
    {
      type: 'payments.CapturePayment',
      data: { paymentId: event.data.paymentId },
    },
  ];
```

`OrderPaymentDue` is an internal event. A module that drove its own process through its external events would have to publish whatever that process needs, such as a `paymentId` here, a `shipmentId` there and the internal statuses on a cancellation. Its external events would turn into a dump of its internals.

Identifiers are derived instead of generated: the order id comes from the cart id, the payment and shipment ids from the order id, and the id of a payment made again from the order id and the attempt number. So handling the same input twice sends two identical commands, and the modules ignore the second one.

### When a step fails

Four kinds of failure cancel an order. In each of them, the order decides what to release:

```mermaid
sequenceDiagram
    participant Customer
    participant Worker as Unpaid orders worker
    participant Order as Order workflow
    participant Pay as Payments
    participant Ship as Shipments

    alt the products are out of stock, or the fulfillment service rejects the request
        Ship->>Order: ShipmentFailed (external)
        Note over Order: cancels once the payment has answered
    else the customer cancels before the confirmation
        Customer->>Order: CancelOrder
    else the order is still unpaid at its dueAt, and nothing was sent
        Worker->>Order: CloseUnpaidOrder
    else the authorization expires between the confirmation and sending the package
        Pay->>Order: PaymentFailed (external)
    end

    Note over Order: decides OrderCanceled, which records where the payment and the products stood
    Order->>Pay: CancelPayment (only if the payment is still authorized)
    Order->>Ship: ReleaseStock (only if the products are still reserved)
```

A failed payment doesn't cancel the order on its own. Before the confirmation the customer can still pay again, so the order records the failure, keeps its products reserved and waits until its `dueAt`. A failed shipment cancels the order, but only once the payment has answered, because whether the payment needs canceling depends on that answer. The same wait covers the normal path, where both modules answer at the same time: the two reservations can arrive in either order, and the order ends up the same.

The order decides what to release. The internal `OrderCanceled` carries `paymentStatus` and `shipmentStatus`, and the workflow's outputs follow from them:

| Status                       | The workflow sends                           |
| ---------------------------- | -------------------------------------------- |
| `paymentStatus = Authorized` | `CancelPayment`                              |
| `shipmentStatus = Reserved`  | `ReleaseStock`                               |
| anything else                | nothing, because there is nothing to release |

There's no refund in that table, because an order can only be canceled before the package leaves, and nobody is charged before that. Once the package has left, canceling is a return, and returns are a process of their own, refund included. A chargeback is another reversal, but the shop can't start it: it starts when the customer disputes the payment. Read more about why compensation matters in [What texting your Ex has to do with Event-Driven Design?](https://event-driven.io/en/what_texting_ex_has_to_do_with_event_driven_design?utm_source=event_sourcing_nodejs).

**Paying again.** A payment can fail before the order is confirmed, when the customer never pays on the provider's page. It can also fail after the package left, when the authorization expires before the charge, or the charge itself fails. Both arrive as `PaymentFailed`, and in both cases the order records `OrderPaymentFailed` and stays open. Before the confirmation it keeps its products reserved, as an unpaid purchase waits on Allegro. After the package left, it can't cancel, because the goods are gone, and it can't complete, because nobody was charged. In both cases, the customer pays again:

- `RetryOrderPayment` makes the order record `OrderPaymentRetried` with a new `paymentId`, derived from the order id and the attempt number, because the failed `Payment` ignores every command;
- the workflow sends `AuthorizePayment` for it, the order status page shows "Pay now" for the new payment, and the customer pays on a new Checkout Session;
- before the confirmation, the authorization confirms the order once the products are reserved. After the package left, it makes the order record `OrderPaymentDue`, so the charge follows at once;
- a payment made again that fails waits for the customer again;
- `PaymentFailed` and `PaymentCaptured` carry the `paymentId`, and the order ignores them for any payment other than its current one, so a late answer about the first payment can't change an order that already moved to the second.

Only an authorization that expires between the confirmation and sending the package cancels the order: the products are released, and nobody was charged.

**Deadlines and workers.** Nothing in the process may wait forever. Three _workers_, background jobs that run on a schedule, watch the deadlines:

| Worker                                                                                                      | Watches                                                                                                            | Sends                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| [paymentTimeoutWorker](./packages/application/src/payments/authorization/paymentTimeoutWorker.ts)           | `timesOutAt` on a payment that waits for the customer: a customer who never pays, or a provider that never answers | `TimeOutPayment`             |
| [authorizationExpiryWorker](./packages/application/src/payments/authorization/authorizationExpiryWorker.ts) | `captureBefore` on an authorized payment                                                                           | `ExpirePaymentAuthorization` |
| [unpaidOrdersWorker](./packages/application/src/orders/unpaid/unpaidOrdersWorker.ts)                        | `dueAt` on an order whose payment failed                                                                           | `CloseUnpaidOrder`           |

The payment workers end at the order as `PaymentFailed`, so the order never waits for a message that isn't coming. Each worker reads a to-do list, as the [event-driven architecture](../../workshops/event_driven_architecture/) workshop calls it: a projection that lists which order or payment to wake up and when. The worker keeps no rules. It stores its command as an input of the workflow, the workflow decides, and a wake-up that comes too early, or twice, appends nothing. Each worker has `handle(now)`. The core's `workersLoop` calls it every minute with the current time, unless the `WORKERS_SCHEDULED` setting is `false`. Tests move the clock and run the workers themselves, with the `timePasses` step.

The deadlines are the shop's rules, and each sits next to the workflow that uses it. The payment workflow gives a new payment its `timesOutAt`, 24 hours after the request. The order workflow gives a failed payment its `dueAt`, 7 days after the failure: Shopify calls that the payment terms, when an order must be paid. The authorization's `captureBefore` comes from the provider, not from the shop, so the sample sets no deadline of its own for it.

If the order is still unpaid at `dueAt`, `UnpaidOrdersWorker` sends `CloseUnpaidOrder`, and the order decides: an order whose package never left is canceled and its products released, and one whose package left ends with `OrderClosedUnpaid`, Shopify's order close. Collecting the money after that is outside the sample.

**Failure events instead of exceptions.** [captureGatewayClient](./packages/application/src/payments/capture/captureGatewayClient.ts), the payment workflow's output handler that asks the payment provider for the charge, calls the provider inside a try/catch and returns `FailPaymentCapture(UnexpectedError)` as the workflow's next input if the call throws. A charge that didn't go through is a business outcome. Rethrowing it would only leave the payment pending forever.

**Canceling by request.** `CancelOrder` from the web API cancels an order that is not confirmed yet, through the same order workflow as every other cancellation. Once the order is confirmed, `CancelOrder` does nothing: the fulfillment request is on its way to the warehouse, as Shopify allows canceling only before fulfillment starts.

### Messages between modules

Commands and events travel the same way between modules, because they differ in intent, not in transport. A person's commands don't: they come through the [web API](#the-web-api-and-the-shop), which hands them to the module's handler directly.

#### Internal and external events

Each module records events for itself: these are its _internal_ events. If a module exposed them to the other modules, every other module would depend on its internal names and data. That is the leaking abstraction described in [Events should be as small as possible, right?](https://event-driven.io/en/events_should_be_as_small_as_possible?utm_source=event_sourcing_nodejs). So each module that others react to also has [external events](https://event-driven.io/en/internal_external_events/?utm_source=event_sourcing_nodejs), made for the other modules. A _forwarder_, a consumer of the module's internal events, publishes the external ones:

| Module         | External events                                                           | Read by |
| -------------- | ------------------------------------------------------------------------- | ------- |
| shopping carts | `shopping_carts.external.ShoppingCartCheckedOut`                          | orders  |
| payments       | `payments.external.PaymentAuthorized`, `PaymentCaptured`, `PaymentFailed` | orders  |
| shipments      | `shipments.external.StockReserved`, `PackageWasSent`, `ShipmentFailed`    | orders  |

Each of them declares its external events as a union type, such as [PaymentExternalEvent](./packages/application/src/payments/external/paymentExternalEvent.ts), so a consumer can switch over all of them.

Payments and shipments are generic services: they know an amount or a list of products, and a `referenceId`, the id of whatever the client pays or ships for, never an order. For the orders module, the `referenceId` is the order id. Their external events carry what any client of such a service needs. The orders module publishes no external events: no module in this sample reacts to the order's events, and an external event that nobody reads is only a guess at what someone might need. The order's events are read only by its own workflow and its own read models.

Two external events cover more than one internal event. `PaymentFailed` stands for `PaymentTimedOut`, `PaymentAuthorizationExpired` and `PaymentCaptureFailed`, and carries no reason, because the order handles all three the same. `ShipmentFailed` stands for `ProductWasOutOfStock` and `FulfillmentRejected`, and carries which one it was, because the order cancels with a different reason, and after a rejection it still has products to release. Inside the module they stay separate events, because the module needs to tell them apart.

Each external event carries only what its reader uses: the `referenceId`, the ids it passes on, the time and, for a shipment, the carrier and tracking number. Amounts, products and deadlines stay inside the module that owns them. Some internal events have no external event at all: `PaymentCanceled` and `StockReleased` end compensations that no module waits for.

#### The projections behind the external events

An external event often needs more than the internal event that triggered it. The internal `ShoppingCartCheckedOut` carries the cart id and a timestamp, but the external `ShoppingCartCheckedOut` has to carry the customer, the products and the total, because the orders module can't call back into the cart to ask. The same is true of `PaymentAuthorized`: internally it has no `referenceId`, and the order needs one.

Where the module's own state holds what the external event needs, the forwarder rebuilds that state from the stream, in its own session: a payment's and a shipment's state already hold the `referenceId`, so their forwarders read the workflow's stream with `aggregateStream`. A cart's state keeps only what its rules need: its products and their prices, but not the customer or the total. So the cart keeps a projection for its forwarder, called a _summary_, and the forwarder reads it:

```typescript
const toExternalEvents =
  (summaries: ShoppingCartSummaries) =>
  async (
    event: RecordedMessage<ShoppingCartEvent>,
  ): Promise<ForwardedMessage<ShoppingCartCheckedOutExternal>[]> => {
    if (event.type !== 'shopping_carts.ShoppingCartCheckedOut') return [];

    const summary = await summaries.get(event.data.shoppingCartId);

    if (!summary)
      throw new Error(
        `Shopping cart '${event.data.shoppingCartId}' has no summary`,
      );

    return [
      {
        type: 'shopping_carts.external.ShoppingCartCheckedOut',
        data: {
          cartId: event.data.shoppingCartId,
          customerId: summary.customerId,
          productItems: summary.productItems,
          totalPrice: summary.totalPrice,
          checkedOutAt: event.data.checkedOutAt,
        },
        metadata: {
          messageId: externalMessageId(
            event.metadata.messageId,
            'shopping_carts.external.ShoppingCartCheckedOut',
          ),
          correlationId: event.metadata.correlationId,
          causationId: event.metadata.messageId,
        },
      },
    ];
  };
```

Each projection is an Emmett [Pongo](https://github.com/event-driven-io/Pongo) single-stream projection, written once in [readModelProjection.ts](./packages/application/src/readModelProjection.ts) for both SQLite and PostgreSQL. It says which events it handles, which _document_ each event belongs to (the stored record of the view, such as one payment summary), and how the event changes that document. Returning `null` deletes it:

```typescript
export const shoppingCartSummariesReadModel = singleStreamReadModel<
  ShoppingCartSummary,
  ShoppingCartEvent
>({
  collectionName: shoppingCartSummariesCollection,
  canHandle: [
    'shopping_carts.ProductItemAddedToShoppingCart',
    'shopping_carts.ProductItemRemovedFromShoppingCart',
    'shopping_carts.ProductItemPriceChanged',
  ],
  getDocumentId: (event) => event.data.shoppingCartId,
  evolve: evolveSummary,
});
```

Emmett runs a projection two ways. _Inline_, the event store updates it in the same transaction as the append. As a background _projector_, `consumer.projector({ processorId, projection })`, a processor of the module's consumer updates it after the append, and stores its checkpoint in the same transaction as the read model. The cart's read models are inline, because the cart appends through the web API: so the forwarder, which reads the event after it was stored, always finds a summary that has already seen it. The read models of orders, payments and shipments are fed by what their workflows append inside a consumer, so they run as projectors on the module's consumer. They are a moment behind the append, which the web API's long-polling and the workers' next run cover.

Besides the summary, the modules keep read models that answer a question that no single stream can answer, because the question spans many of them:

| Read model              | Answers                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `pendingPayments`       | which payments still wait for the customer at their `timesOutAt`                  |
| `authorizedPayments`    | which authorized payments have passed `captureBefore`                             |
| `ordersAwaitingPayment` | which orders with a failed payment are still unpaid at their `dueAt`              |
| `customerShoppingCarts` | which cart is the customer's current one, and how many carts the customer has had |

The first three are the workers' to-do lists. The cart's handler reads `customerShoppingCarts` to choose the cart for the customer's next product. The customer's pages get read models of their own, described in [The web API and the shop](#the-web-api-and-the-shop).

#### Channels and queues

A _channel_ is a named place where a module publishes messages. A _queue_ is where a module receives them: it is bound to one or more channels. Each message also gets a _routing key_, a dotted text such as `ecommerce.order.42-1`, and a queue gets only the messages whose key matches the pattern it was bound with. Each module owns its channels and names them `<module>-<purpose>`. The purposes come from [Internal and external events](https://event-driven.io/en/internal_external_events/?utm_source=event_sourcing_nodejs) and [Predictable identifiers](https://event-driven.io/en/predictable-identifiers-enabling/?utm_source=event_sourcing_nodejs): `internal` for the module's own commands, `external` for the events it publishes to anyone, `requests` for the commands that other modules send it, and `responses` for its answers to them.

| Channel                   | Carries                                                 | Who sends                | Queue that reads it                               |
| ------------------------- | ------------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| `shopping_carts-external` | `ShoppingCartCheckedOut`                                | the cart forwarder       | `orders-shopping_carts-external`, owned by orders |
| `orders-internal`         | `CloseUnpaidOrder`                                      | the unpaid orders worker | `orders-internal`                                 |
| `payments-requests`       | `AuthorizePayment`, `CapturePayment`, `CancelPayment`   | the order workflow       | `payments-requests`                               |
| `payments-responses`      | `PaymentAuthorized`, `PaymentCaptured`, `PaymentFailed` | the payment forwarder    | `orders-payments-responses`, owned by orders      |
| `payments-internal`       | `TimeOutPayment`, `ExpirePaymentAuthorization`          | the payment workers      | `payments-internal`                               |
| `shipments-requests`      | `ReserveStock`, `ReleaseStock`, `RequestFulfillment`    | the order workflow       | `shipments-requests`                              |
| `shipments-responses`     | `StockReserved`, `PackageWasSent`, `ShipmentFailed`     | the shipment forwarder   | `orders-shipments-responses`, owned by orders     |

A channel carries many message types. The type only picks the handler inside the queue, so adding a message adds no channel.

The answers of the outside systems don't travel on channels. The payment provider and the warehouse answer through their own calls, and the sandboxes store each answer, such as `ConfirmPaymentAuthorization` or `ConfirmPackageSent`, as an input of the module's workflow, as a webhook handler would.

`<module>-internal` carries a module's commands to itself. The `MESSAGING_INTERNAL_DELIVERY` setting chooses how: `broker` (the default) sends them through the broker, like any other channel, and `store` appends them to a channel stream in the module's own event store, where the module's channel reader picks them up. Without a broker (`MESSAGING_BUS=none`), they always go through the store.

Each module declares its routes, channels and queues in its configuration, such as [paymentsConfig.ts](./packages/application/src/payments/paymentsConfig.ts):

```typescript
export const paymentsRequestRoutes = messageRoutes<
  ForwardedMessage<PaymentRequest>
>(
  routeChannel<ForwardedMessage<PaymentRequest>>(
    isPaymentRequest,
    paymentsRequestsChannel,
  ),
  routeKey<ForwardedMessage<PaymentRequest>>(isPaymentRequest, (message) =>
    Urns.routingKeyOf(message.data.paymentId),
  ),
);

export const paymentsResponseRoutes = messageRoutes<
  ForwardedMessage<PaymentExternalEvent>
>(
  routeChannel<ForwardedMessage<PaymentExternalEvent>>(
    isPaymentResponse,
    paymentsResponsesChannel,
  ),
  routeKey<ForwardedMessage<PaymentExternalEvent>>(
    isPaymentResponse,
    (message) => Urns.routingKeyOf(message.data.referenceId),
  ),
);
```

- the routes decide the channel and the routing key of each message that the module publishes. A message with no route, or one routed to a channel that the module didn't declare, fails the forwarding with an error that names the message type or the channel;
- a subscription connects a queue to a channel for the routing keys that match a pattern: `*` matches one word, `#` any number of words. A queue can be bound to another module's channel, as orders binds its queues to `payments-responses`, using that module's public channel name;
- each module's _channel readers_ take the messages from its queues and store them as inputs of the module's workflow.

[messaging.ts](./packages/application/src/messaging.ts) builds the forwarders and the readers for the chosen bus, and declares the topology (Kafka topics, RabbitMQ exchanges and queues) when the application starts. No module uses another module's code: the modules share only the core package, the other modules' public channel names and their external event types.

#### Type names

Every message and stored event carries the name of its type, so the reader knows what it got. The name is the module, a dot and the message, such as `payments.PaymentAuthorized`, and an external event has `external` in the middle: `payments.external.PaymentAuthorized`. So two modules can't clash on a name, and an external event never looks like the internal one. The event stores write the name next to the event. On Kafka and RabbitMQ, the body is the message's data, and the name travels in the `message-type` header, next to `message-id`, `correlation-id`, `causation-id` and `forwarded-at`.

A response goes back to whoever asked, without payments knowing who that is. Its routing key comes from the `referenceId`, which is a _URN_: a standard text id made of a namespace, a type and a value, such as `urn:ecommerce:order:42-1`. That URN becomes the key `ecommerce.order.42-1`. Orders binds its queue to `payments-responses` with `ecommerce.order.*`, so it gets the answers about orders and nothing else. Another client of payments would bind its own queue with its own prefix. The requester owns the queue that reads the responses, as orders owns `orders-payments-responses`.

RabbitMQ's topic exchanges match the patterns themselves. Kafka has no such matching, so with Kafka the consumer reads the channel's topic and routes by key itself. With the in-memory bus or no broker, the core's channel readers do the same over the channel streams. `MESSAGING_BUS` chooses the bus.

### Delivering messages reliably

A module that stores an event and then publishes a message has a problem: a crash between the two steps loses the message, or publishes a message for an event that was never stored. Two writes to two systems can't be made atomic without a distributed transaction. The _outbox pattern_ solves this: the module writes the message to its own database in the same transaction as its data, and a separate process publishes it from there.

With Event Sourcing, the event store already is that outbox. A handler only appends events, and a workflow appends its outputs, the commands for the other modules, in the same append as its events. Emmett's _consumers_ read the stored messages again, each _processor_ from its own _checkpoint_, the position of the last message it handled, and the forwarders publish from there. Each module's event store has its own consumers:

- one runs the module's workflow, its channel readers and its projectors;
- one runs the module's forwarders. A forwarder that retries, because the broker is down, holds up only itself, and the workflow keeps running.

On SQLite, each module has its own file, and a consumer polls it. On PostgreSQL, each module has its own schema, and a consumer polls it, reading only messages from transactions that have already committed, so it never passes one that is still running. Emmett keeps each processor's checkpoint in the same database, so a restart continues where it stopped.

A forwarder publishes first and then stores its checkpoint, so a crash between the two publishes the message again. Every message has a `messageId`, derived from the stored event, so the copy has the same id, and the receiving workflow's inbox skips an input it has already handled. A failing forwarder or reader retries with a back-off, and a reader dead-letters a message it can't store after its retries, into a `<queue>-dlq` channel stream or the broker's dead-letter queue. So each message reaches each module at least once, and maybe more than once. That is called _at-least-once delivery_, and it is why every handler has to be idempotent.

Only forwarders publish, so no module sees another module's internal events. The order workflow gets both sides as inputs: the other modules' external events from its queues, and the customer's commands from the web API.

[application.ts](./packages/application/src/application.ts) is the _composition root_: it builds each module's stores, consumers, workflows, forwarders, readers and workers, and the web API, from the settings that [buildApplication.ts](./packages/application/src/buildApplication.ts) reads.

#### Waiting for a bus or a consumer to catch up

Tests don't wait a fixed time to see that nothing more happens. Each Emmett consumer has `whenCaughtUp`, which returns once its processors have handled every message stored before the call. The Kafka and RabbitMQ consumers of the core package have the same: Kafka compares the consumer group's committed offsets with the end offsets of its topic, and RabbitMQ sends a probe through each queue. `ApiE2ESpecification` waits for all consumers after each step, and repeats that until a round stores nothing new. So a scenario checks its outcome once, on Kafka and RabbitMQ as in memory.

### The payment provider and the fulfillment service

The payment provider and the fulfillment service are outside systems. Each sits behind an interface:

```typescript
export type PaymentGateway = {
  createCheckoutSession: (
    request: CheckoutSessionRequest,
  ) => Promise<CheckoutSession>;
  expireCheckoutSession: (paymentId: string) => Promise<void>;
  capture: (paymentId: string, amount: number) => Promise<void>;
  cancel: (paymentId: string) => Promise<void>;
};

export type WarehouseGateway = {
  isProductAvailable: (productItem: ShipmentProductItem) => Promise<boolean>;
  request: (
    shipmentId: string,
    productItems: ShipmentProductItem[],
  ) => Promise<void>;
};
```

The Checkout Session is created while the customer waits, in the request behind "Pay now". The `CheckoutSession` carries the page's URL and its expiry. The request brings the `successUrl` and the `cancelUrl`, both the order status page, as Stripe's API takes them for each session, so payments still knows nothing about orders. If the provider fails to create the session, the request fails and nothing is recorded: the customer can click again, and the payment timeout worker covers a customer who gives up.

The rest of the provider's API is called from the payment workflow's _output handler_: Emmett's place for a call to an outside system, which runs after the workflow stored its decision, and whose answer becomes the workflow's next input. The [authorization](./packages/application/src/payments/authorization/authorizationGatewayClient.ts) client cancels a canceled payment at the provider, and expires the open Checkout Session of a payment that timed out, so the customer can't pay what the shop no longer waits for. The [capture](./packages/application/src/payments/capture/captureGatewayClient.ts) client asks for the charge. In production, the provider answers the authorization and the charge later, through a webhook. So the result always arrives as an input, as from a real webhook, and never as the return value of the call. Canceling does not answer back: an authorization that is not canceled expires on its own.

The shipment workflow's output handler, [fulfillmentServiceClient](./packages/application/src/shipments/fulfillment/fulfillmentServiceClient.ts), asks the warehouse whether the products are in stock when the shipment records `StockCheckRequested`, and returns the answer, `ConfirmStockAvailability`, as the next input. If the warehouse doesn't answer, it retries with a back-off until it does. It also sends the request to the fulfillment service when the shipment records `FulfillmentRequested`. The service answers later: `ConfirmPackageSent` with the carrier and the tracking number, or `RejectFulfillment`, and later `DeliverPackage`. If that call fails, nothing is recorded, and the order is canceled when the authorization expires.

**The sandboxes.** When the application runs, sandboxes play both outside systems, so that you can go through a purchase without an account at a real provider. [sandboxPaymentGateway](./packages/application/src/payments/sandbox/sandboxPaymentGateway.ts) serves its own payment page, laid out like Stripe Checkout, and takes Stripe's test cards: 4242 4242 4242 4242 pays, and 4000 0000 0000 0002 is declined and stays on the page, so the customer can try again. The card number field suggests both cards. Paying stores `ConfirmPaymentAuthorization` with a 7-day `captureBefore`, as the webhook would, and sends the browser to the `successUrl`. A charge is confirmed at once.

[sandboxWarehouse](./packages/application/src/shipments/sandbox/sandboxWarehouse.ts) plays the warehouse and its fulfillment service. It keeps the stock and the packages it was asked to send, and its page at `/sandbox/warehouse` lets a person play the warehouse: **Send** stores `ConfirmPackageSent` with the carrier "Sandbox Express", **Reject** stores `RejectFulfillment`, and **Deliver** stores `DeliverPackage`. A product marked out of stock makes the next reservation fail. The demo product "Limited edition trail shoes" is out of stock from the start. In the tests, named fakes play both systems and store the same inputs.

### The web API and the shop

The web API has an endpoint only for what a person does. The workflows, the workers and the clients of the payment provider and the fulfillment service talk through messages, so their commands have no endpoint. The answers of the payment provider and the fulfillment service would be webhooks in production, and the sandboxes store them as workflow inputs instead. Each endpoint calls its module's handler or read model directly. There is no real sign-in, so the customer id is part of the URL:

| Endpoint                                                                                   | Module                   | Does                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------ |
| `GET /customers/{customerId}/shopping-carts/current`                                       | shopping carts           | reads the `carts` read model, newer than `If-None-Match`           |
| `POST /customers/{customerId}/shopping-carts/current/product-items`                        | shopping carts           | `AddProductItemToShoppingCart`                                     |
| `DELETE /customers/{customerId}/shopping-carts/current/product-items?productId=&quantity=` | shopping carts           | `RemoveProductItemFromShoppingCart`, with `If-Match`               |
| `POST /customers/{customerId}/shopping-carts/current/checkout`                             | shopping carts           | `CheckOutShoppingCart`, with `If-Match`                            |
| `GET /customers/{customerId}/orders`                                                       | orders                   | reads the `customerOrders` read model                              |
| `GET /customers/{customerId}/orders/{orderId}`                                             | orders                   | reads the `orderStatuses` read model, newer than `If-None-Match`   |
| `POST /customers/{customerId}/orders/{orderId}/cancel`                                     | orders                   | `CancelOrder`, 202 Accepted                                        |
| `POST /customers/{customerId}/orders/{orderId}/retry-payment`                              | orders                   | `RetryOrderPayment`, 202 Accepted                                  |
| `POST /customers/{customerId}/orders/{orderId}/payments/{paymentId}/checkout-session`      | orders, calling payments | `CreateCheckoutSession`, then 303 See Other to the provider's page |

In the URLs, an order is its number, `1` for the customer's first order, and a payment the last part of its URN. The order's full id is `{customerId}-{n}`, the same as its cart's, because the order workflow derives the order id from the cart id.

The cart answers every command with its new version as an `ETag`. Removing a product and checking out need the version that the customer saw, in `If-Match`. A checkout that goes through answers 202 Accepted with `Location`, the order status: the order workflow places the order after the cart's event. A checkout that finds a changed price answers 409 Conflict with the new version in `ETag`, and the customer reads the cart again. A version conflict answers 412 Precondition Failed, a broken rule 409 Conflict, a malformed version 400 Bad Request, a cart, order or payment that does not exist 404 Not Found, and a provider that can't open the payment page 502 Bad Gateway. Emmett's Hono integration maps the errors to problem details, the standard JSON format for HTTP errors ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)).

The customer's pages read read models made only for them, named after Shopify's pages:

| Read model       | Shopify's page    | Shows                                                                                                                         |
| ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `carts`          | Cart              | the lines with their unit prices, the total, and the cart's version                                                           |
| `customerOrders` | Orders            | the customer's orders: when each was placed, its total and its progress                                                       |
| `orderStatuses`  | Order status page | the products, the total, the progress, the carrier and tracking number, the current payment, and what the customer can do now |

The order status is also the page that the provider returns the customer to, as both the `successUrl` and the `cancelUrl`. It offers "Pay now" while the payment waits for the customer, "Cancel order" until the order is confirmed, and "Retry payment" when a payment failed and the order can still be paid. "Pay now" carries the id of the payment that waits: the first one is derived from the order id, as the order workflow derives it, and the id of a payment made again comes in `OrderPaymentRetried`. The checkout-session endpoint sits under the order, so it builds both URLs from its own path and needs no lookup. The read model only shows what the order would accept. The order still decides.

**The shop.** The same flow is also served as server-rendered pages, with Hono's JSX. Each module serves its own pages next to its web API: [shoppingCartPages](./packages/application/src/shoppingCarts/shoppingCartPages.tsx) serves Products and Cart, and [orderPages](./packages/application/src/orders/orderPages.tsx) serves Orders and Order status. [shop](./packages/application/src/shop/) holds only what the modules share: the login and the page layout. The login asks only for a name and makes the customer id from it, so the same name always opens the same orders. A few demo products stand in for a catalog of products. The pages call the same handlers and read models as the web API. The running application gives the customer 7 days to pay a failed payment again, Shopify's "Within 7 days", and 24 hours for a payment, and runs the three workers every minute.

**Reading what you just wrote.** The read models of one module are updated in the same transaction as its append, but a read right after a write can still come before the write of another module. For example, the order status page opens right after the checkout, but the order workflow places the order a moment later. The application doesn't make the client try again. It waits on the server instead, as described in [Long-polling, how to make our async API synchronous](https://event-driven.io/en/long_polling_and_eventual_consistency/): [longPolling](./packages/core/src/http/longPolling.ts) reads the read model again, with a growing delay, for up to one second. Node.js handles the waiting request without blocking the others.

The web API uses the `ETag` for that. A read of the cart or the order status can send `If-None-Match` with the `ETag` of the version the client has already seen. The answer is then the first newer version, with its `ETag`, or `304 Not Modified` if nothing newer came within the second ([conditionalRead](./packages/core/src/http/conditionalRead.ts)). An order that isn't there within the second answers `404 Not Found`.

Browsers don't follow `Retry-After`, so the pages never answer an error while they wait. The cart page waits for the version that the add, remove or checkout wrote. The order page waits for the order, and if it still isn't there, it says "Your order is being placed". From then on, [htmx](https://htmx.org/) keeps the page up to date: every second it asks for news with `If-None-Match`, and the server answers either the new order status, which htmx morphs into the page without reloading it, or `304`, after which nothing changes. A completed, canceled or closed order is shown without the polling, so the polling stops. Without JavaScript, the "being placed" page reloads itself every second instead.

### Running the application

The application runs on real infrastructure by default: Kafka and PostgreSQL. `docker compose --profile sample up -d --wait` starts them, and `npm start` starts the application, as [the HOWTO](./HOWTO.md#1-start-the-application) describes. Environment variables choose the implementations, and [settings.ts](./packages/application/src/settings.ts) reads them:

| Setting                                                                 | Values                                   | Default                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `MESSAGING_BUS`                                                         | `in-memory`, `none`, `kafka`, `rabbitmq` | `kafka`                                                  |
| `EVENTSTORE_TYPE`                                                       | `sqlite`, `postgresql`                   | `postgresql`                                             |
| `MESSAGING_INTERNAL_DELIVERY`                                           | `broker`, `store`                        | `broker`                                                 |
| `SQLITE_FOLDER`                                                         | a folder for the SQLite files            | a temporary folder, removed on stop                      |
| `POSTGRESQL_URL`                                                        | a connection string                      | `postgresql://postgres:postgres@localhost:5432/postgres` |
| `KAFKA_BOOTSTRAP_SERVERS`                                               | a comma-separated list                   | `localhost:9092`                                         |
| `RABBITMQ_URL`                                                          | an AMQP URL                              | `amqp://guest:guest@localhost:5672`                      |
| `MESSAGING_KAFKA_PUBLISH_TIMEOUT`, `MESSAGING_RABBITMQ_PUBLISH_TIMEOUT` | a duration, such as `10s`                | `10s`                                                    |
| `MESSAGING_RETRY_INITIAL_INTERVAL`                                      | a duration                               | `1s`                                                     |
| `WORKERS_SCHEDULED`                                                     | `true`, `false`                          | `true`                                                   |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                           | the OpenTelemetry collector              | `http://localhost:4318`                                  |
| `SHOP_GRAFANA_URL`, `SHOP_EVENTCATALOG_URL`                             | the links of **Developer tools**         | `http://localhost:3000`, `http://localhost:3001`         |
| `PORT`                                                                  | the port of the shop and the web API     | `8080`                                                   |

A value outside the list stops the start and names the setting. The modules don't change with the settings. `in-memory` keeps the channels as streams of a separate `broker` database, and `none` has no broker at all: a module's forwarder appends its messages straight into a channel stream in the receiving module's database. With SQLite and no broker, the application needs no Docker.

### Testing the application

#### Module tests

The tests treat the application as a black box. They reach it the way the outside world does: the customer sends HTTP requests, the other modules, the payment provider and the warehouse send messages, and time passes for the workers. Then they check what the outside world can see: the response, the messages that the application published, and what it appended. [ApiE2ESpecification](./packages/core/src/testing/apiE2ESpecification.ts) extends [Emmett](https://github.com/event-driven-io/emmett)'s helper of the same name for Hono, and its unit tests check the helper itself.

Each module has one test file next to its web API, such as [ordersApi.api.spec.ts](./packages/application/src/orders/ordersApi.api.spec.ts), with a nested `describe` per endpoint. A test sets the module up with named scenarios: arrays of steps named after the state they lead to. The orders get their order from the cart's `ShoppingCartCheckedOut`, as in production, not from the cart's endpoints:

```typescript
const placedOrder = [send(checkedOut())];
const paidAndReservedOrder = [
  ...placedOrder,
  send(paymentAuthorized()),
  send(stockReserved),
];
const sentOrder = [...paidAndReservedOrder, send(packageWasSent)];
const completedOrder = [...sentOrder, send(paymentCaptured())];
const orderWithFailedPayment = [...placedOrder, send(paymentFailed())];
```

```typescript
it('retryingAFailedPaymentAsksToAuthorizeTheNewPayment', () =>
  given(...orderWithFailedPayment)
    .when(retryOrderPayment(customerId, orderNumber))
    .then(
      expectResponse(202),
      expectPublished(authorizePayment(retriedPaymentId)),
    ));
```

`expectResponse` checks the status, and optionally the headers and the part of the JSON body that the test names. `expectError` does the same for problem details. `expectPublished` checks the messages that the `when` step published, all of them, keeping their order for each routing key, and `expectAppended` checks the events it appended. A test file sees only the messages it is about. `send` is a message arriving from outside. A given request that fails stops the test before the `when` step, unless the scenario marks it as an `attempt`. The ids are known up front: the first order of a customer is `{customerId}-1`.

#### Purchases across the modules

The purchases across the modules are scenarios in [purchaseScenarios.ts](./packages/application/src/purchaseScenarios.ts). [shopTestApplication](./packages/application/src/shopTestApplication.ts) builds the application from the same settings as `npm start`, with a movable clock and changeable prices, and the sandboxes play the payment provider and the warehouse. A scenario goes through the pages and the web API, as the customer does:

```typescript
scenario(
  'aPaidSentAndCapturedOrderCompletes',
  ({ given, paidOrder, warehouseButton, orderStatus }) =>
    given(...paidOrder)
      .when(warehouseButton('send'))
      .then(
        expectResponse(303),
        orderStatus({
          progress: 'Completed',
          stage: 'Ended',
          carrier: sandboxCarrier,
        }),
      ),
);
```

The same scenarios run on three setups: SQLite without a broker ([purchaseOnSQLite.e2e.spec.ts](./packages/application/src/purchaseOnSQLite.e2e.spec.ts)), Kafka with PostgreSQL ([purchaseOnKafka.e2e.spec.ts](./packages/application/src/purchaseOnKafka.e2e.spec.ts)), and RabbitMQ with PostgreSQL ([purchaseOnRabbitMQ.e2e.spec.ts](./packages/application/src/purchaseOnRabbitMQ.e2e.spec.ts)). After each step, the test waits until the consumers have caught up, because the handlers run after the request answered, and the rounds repeat until one stores nothing new. The workers aren't scheduled in the tests (`WORKERS_SCHEDULED=false`): the `timePasses` step moves the clock and runs them, as the scheduler would.

#### The format of the messages and the web API bodies

The tests above write and read each message with the same code, so they still pass after a field is renamed. What breaks is what holds the old JSON: an event stored before the rename, a message still waiting on a broker, or a client that reads the web API. The contract tests catch that change in the build. Each module has a contract test file, such as [paymentContracts.unit.spec.ts](./packages/application/src/payments/paymentContracts.unit.spec.ts), and examples of all its messages, in [paymentContracts.ts](./packages/application/src/payments/paymentContracts.ts). Each test writes an example the way the application writes it, a stored event through Emmett's `JSONSerializer` and a message sent to a broker as its headers and body, and compares the JSON with the approved snapshot, a file in the module's `contracts` folder, such as `payments/contracts/messages/payments.PaymentCanceled.all-fields.json`.

A message with optional fields has two shapes, so it gets two snapshots: `all-fields` and `required-only`. A test fails when a message has optional fields and no `required-only` example. `OrderCanceled` also keeps its earlier form, before it had a shipment id, and a test reads that file with the current code, so the order still understands events stored before the change.

When the JSON differs, the test fails with the difference. If the change is intended, run the tests with `-u` to write the new snapshot, and commit it with the code. The stored events and the messages written before the change keep the old format, so the new code must still read them. A new message has no snapshot yet: its first run writes one, which you review and commit with the test.

#### Browser tests

The browser tests use [browserE2ESpecification](./packages/application/src/browserE2ESpecification.ts), the same specification in [Playwright](https://playwright.dev/) and Chromium. A step is what a person does on the pages, and [customerInBrowser](./packages/application/src/shop/customerInBrowser.ts) and [warehouseKeeper](./packages/application/src/shipments/sandbox/warehouseKeeper.ts) name those steps. Next to the other expectations, a test checks the page, and fails when the browser reports an error. This test, from [shopTelemetryInBrowser.e2e.spec.ts](./packages/application/src/shopTelemetryInBrowser.e2e.spec.ts), shops on Kafka and PostgreSQL, where the read models catch up after the writes:

```typescript
scenario(
  'theWarehouseSendingThePackageCompletesTheOrderOnTheCustomersPageInPlace',
  (signal) => {
    const { given, customer, warehouse, paidOrder /* ... */ } =
      shopping(signal);

    return given(...paidOrder)
      .when(warehouse.sendsThePackageOf(customer))
      .then(
        expectPageShowing('Completed', 'Sandbox Express'),
        expectPageNotShowing('Pay now'),
        expectUpdatedInPlace,
        expectNoFailedResponses,
      );
  },
);
```

`expectUpdatedInPlace` checks that the page changed without reloading. [shopInBrowser.e2e.spec.ts](./packages/application/src/shop/shopInBrowser.e2e.spec.ts) goes through the shop and takes the screenshots of [HOWTO.md](./HOWTO.md) with `screenshot(name)` steps, and the telemetry tests take the screenshots of the Grafana dashboard and alerts. `npm run screenshots` takes them all again, with the EventCatalog ones.

#### Where the tests run

The module tests run on SQLite, with the in-memory bus and without a broker. The tests of the Kafka, RabbitMQ and PostgreSQL implementations, and the purchase scenarios on Kafka and RabbitMQ, start their servers with [Testcontainers](https://testcontainers.com/), so running them needs only Docker. Tests share one server and give each test its own ids, so they don't mix. The browser tests send their telemetry to the Docker Compose Grafana when it runs, and start their own when it doesn't.

In a dev container, stop the Docker Compose Kafka before you run the Kafka tests. In a dev container, Docker is the host's Docker, and the Compose Kafka advertises `localhost:9092`, which inside the container is the container itself.

### Seeing what happens: traces, metrics and logs

A purchase goes through four modules and a broker, so the log of one module tells only a small part of it. The application reports what happens with [OpenTelemetry](https://opentelemetry.io/), through [Emmett's observability](https://github.com/event-driven-io/emmett) and the OpenTelemetry Node.js SDK, in three forms:

- a _trace_ follows one request through the steps it caused. It is a tree of _spans_: one span for each step, such as handling a command, running a workflow or appending to a stream, each with the time it took and _attributes_ that describe it;
- _metrics_ count and time what happens, for example how many orders were completed in the last hour;
- _logs_ are the application's log lines, each with the id of the trace it belongs to.

[telemetry.ts](./packages/application/src/telemetry/telemetry.ts) starts the SDK and sends all three over OTLP, OpenTelemetry's protocol, to `OTEL_EXPORTER_OTLP_ENDPOINT`. The Docker Compose services include Grafana LGTM, which receives them: Tempo keeps the traces, Prometheus the metrics and Loki the logs, and Grafana, at <http://localhost:3000>, shows them. If Grafana doesn't run, the application works the same, and the exporters stay quiet. Grafana keeps the plugin versions it comes with (`GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false`, in Docker Compose and in the tests). By default, about a minute after it starts, Grafana downloads a newer Prometheus plugin and swaps it in, and during the swap the Prometheus queries answer `404 Unable to find datasource plugin`. [HOWTO.md](./HOWTO.md#11-look-at-the-purchase-in-grafana) walks through a purchase in Grafana.

**What a trace shows.** Emmett makes the spans: for each HTTP command, each append to a stream, and each message that a consumer, a workflow or a forwarder handles. A consumer starts a new trace for each message it handles, and links it to the trace of the request that caused it, so a purchase is a set of linked traces, one for each step, not one tree. Tempo shows the links, and you follow them from one step to the next.

**Correlation and causation ids.** These ids are for tracing and diagnostics only. No business decision reads them. Each message and event carries three ids in its metadata:

- its own _message id_;
- a _correlation id_, shared by every message and event that one HTTP request led to, so you can find all of them;
- a _causation id_: the id of the message that was being handled when this one was written, so you can see which message led to which.

Emmett gives each appended message these ids from the message that its handler handles, and the forwarders copy them to the messages they publish, as `correlationId` and `causationId` in the stored metadata and as the `correlation-id` and `causation-id` headers on Kafka and RabbitMQ. The next module reads them back. An HTTP request gets a new correlation id. So does a message that arrives from outside without ids, such as a payment provider's answer. So one purchase has more than one correlation id: **Check out** starts the first one, and **Pay now**, a new HTTP request, starts the next. A forwarder that runs again after a crash publishes its messages with the same message ids, because each id is derived from the id of the event it forwards.

**Metrics.** Emmett counts and times what happens:

- `emmett.command.handling.duration` times the commands, by status;
- `emmett.event.appending.count` counts the appended events of each type. The dashboard counts orders, payments and shipments with it;
- `emmett.stream.appending.duration` times the appends;
- `emmett.processor.processing.duration` and `emmett.workflow.processing.duration` time the consumers' processors and the workflows.

Emmett doesn't report everything the dashboards need, so the sample adds the rest:

- `http.server.request.duration` times each HTTP request, by method, route and status code, from a Hono middleware in [httpMetrics.ts](./packages/application/src/telemetry/httpMetrics.ts);
- `messaging.published`, `messaging.handled` and `messaging.failed` count the messages by channel or queue and type, in the core's forwarders and readers ([messagingMetrics.ts](./packages/core/src/messaging/messagingMetrics.ts));
- `messaging.dead_lettered` counts the messages that failed every retry;
- `messaging.lag.milliseconds` is the time from a forwarder publishing a message to a reader handling it. The forwarders stamp `forwardedAt` on each message, in its metadata on a channel stream and in the `forwarded-at` header on Kafka and RabbitMQ.

**Business metrics.** The orders module adds the numbers a shop owner asks about, in [orderMetrics.ts](./packages/application/src/orders/orderMetrics.ts):

- `ecommerce.order.revenue.dollars`: the amount charged for each order;
- `ecommerce.order.lead.time`: how long an order took from being placed to being paid, to its package leaving, and to being completed;
- `ecommerce.orders.in.progress`: how many orders are still running;
- `ecommerce.orders.awaiting.payment`: how many orders wait for the customer to pay again.

**Why the counters start at 0.** Prometheus shows how much a counter grew between two of its readings. A counter that appears for the first time at 1 has no earlier reading, so that first 1 never shows as growth. For a failed capture, that would hide the first failure from the dashboard and the alerts. So [metricSeriesAtZero.ts](./packages/application/src/telemetry/metricSeriesAtZero.ts) creates the counts of every event type and every command type at 0 when telemetry starts, as [Axon](https://docs.axoniq.io/axon-framework-reference/4.10/monitoring/metrics/)'s `MessageCountingMonitor` creates its counters on the first message. So the first `PaymentCaptureFailed` already fires **Capture failed**.

**Dashboards.** Three dashboards come with the sample, from [observability/dashboards](./observability/dashboards):

- **Purchases** counts what customers do and what goes wrong: orders, payments and shipments, and, under **Watch out**, the failed commands, timeouts, dead letters, failed message handlers and the lag. Under **Business**, it shows the business metrics: how many checkouts became orders and how many orders got paid, the payment failures, the reservations that found a product out of stock, the revenue and the average order value, the orders still running and the ones that wait to be paid again, and how long an order takes to be paid, sent and completed;
- **Commands and event store** shows the commands by status, their latency, the appended events and the appends, the HTTP requests, the lag, and how long processors and workflows take;
- **Purchase flow** shows the messages published, handled and failed in each channel, the dead letters and the HTTP requests.

Emmett reports commands only by status, not by type, and doesn't count reads or append conflicts, so these dashboards have no panels for them, unlike the Java sample's.

**Alerts.** Grafana loads eight alert rules from [observability/alerting/ecommerce.yaml](./observability/alerting/ecommerce.yaml). The first four watch the purchases themselves, because the servers can look healthy while customers can't buy. The other four watch the application: its messages, its commands and its web API.

| Alert                | Fires when                                                             | Fires           |
| -------------------- | ---------------------------------------------------------------------- | --------------- |
| Payments failing     | more than 20% of at least 5 payments failed in 15 minutes              | after 5 minutes |
| Capture failed       | a package left, but the provider refused to charge                     | at once         |
| Money lost           | an order closed unpaid, or a payment hold expired before the charge    | at once         |
| Checkout broken      | customers checked out in 10 minutes, but no order was placed           | after 2 minutes |
| Views falling behind | the 95th percentile of the lag is above 5 seconds                      | after 5 minutes |
| Dead letters         | a message failed every retry                                           | at once         |
| Commands failing     | more than 5% of the commands failed in 10 minutes                      | after 5 minutes |
| HTTP errors          | more than 1% of the requests answered with a server error in 5 minutes | after 5 minutes |

A rule that fires at once watches something that needs a person every time it happens. A rule that waits watches a rate, and fires only when the rate stays bad, not on one slow moment. The thresholds are a starting point: set yours from your own traffic. The rules have no contact point, so they show only under **Alerting** in Grafana, as in [step 11 of the how-to](./HOWTO.md#see-the-alert-rules). Add a contact point, such as Slack or e-mail, to be told.

**Testing it.** [telemetry.int.spec.ts](./packages/application/src/telemetry/telemetry.int.spec.ts) checks that the metrics reach an OTLP endpoint, [metricSeriesAtZero.api.spec.ts](./packages/application/src/telemetry/metricSeriesAtZero.api.spec.ts) that the counters start at 0, and [noOtlpEndpoint.api.spec.ts](./packages/application/src/telemetry/noOtlpEndpoint.api.spec.ts) that the application works the same without a collector. The browser tests send a purchase to a real Grafana LGTM, with the sample's dashboards and alert rules, and check it with [grafanaApi](./packages/application/src/telemetry/grafanaApi.ts). They wait until Grafana has the data, because the export is asynchronous:

```typescript
return given(...paidOrder)
  .when(warehouse.sendsThePackageOf(customer))
  .then(
    expectPageShowing('Completed'),
    inGrafana.expectTracesInTempo(
      `{ resource.service.name = "${serviceName}" }`,
    ),
    inGrafana.expectEventsAppended('orders.OrderPlaced'),
    inGrafana.expectEventsAppended('orders.OrderCompleted'),
    inGrafana.expectLogsOf(serviceName),
    inGrafana.expectMetricInPrometheus(
      'sum(emmett_workflow_processing_duration_count)',
    ),
    inGrafana.expectAlertRules('Payments failing', /* ... */ 'HTTP errors'),
    inGrafana.expectMetricInPrometheus('sum(messaging_handled_total)'),
    // ... the screenshots of the dashboards and the alert rules
  );
```

**When something looks wrong.**

- _Grafana shows nothing._ Check that the `otel-lgtm` service runs (`docker compose --profile otel up -d`) and that the application reaches it on port 4318 (`OTEL_HTTP_PORT`). The application sends metrics every 10 seconds.
- _A purchase forms many traces._ That is expected: each consumer that handles a message starts a trace, linked to the one before it, and **Pay now** is a new HTTP request. Follow the links in Tempo.
- _A panel shows no data after one purchase._ Prometheus needs two samples of a series to show an increase. The next purchase shows.
- _A message ends up in a dead-letter queue._ A channel reader dead-letters a message that it couldn't store after its retries, into `<queue>-dlq`. The application's log has the error of each attempt.

### Documenting the messages

#### What to document, and why

A team that wants to call another module's web API needs to know its endpoints. [OpenAPI](https://www.openapis.org/) is a standard format for that: a JSON file that lists each endpoint, what it takes and what it returns. Such a file is called an _OpenAPI document_. Tools read it: Swagger UI shows it as a page where you can call each endpoint, and code generators make clients from it.

Messages need the same, and more. They have no URLs to list. A team that wants to use a module's messages needs to know which channels exist, which messages travel on each channel, what each message contains and means, and which module sends or receives it. Without a written answer, they read the code or ask. [AsyncAPI](https://www.asyncapi.com/) is the standard format for that, and an _AsyncAPI document_ is a JSON file in that format. This is a shortened part of the payments module's document, `eventcatalog/specs/asyncapi-payments.json`:

```json
{
  "asyncapi": "3.0.0",
  "info": {
    "title": "E-commerce payments",
    "description": "The messages the payments module sends and receives."
  },
  "operations": {
    "payments.send.payments.external.PaymentAuthorized": {
      "action": "send",
      "channel": { "$ref": "#/channels/payments-responses" },
      "summary": "The payment of a reference was authorized.",
      "messages": [
        {
          "$ref": "#/channels/payments-responses/messages/payments.external.PaymentAuthorized"
        }
      ]
    }
  },
  "components": {
    "messages": {
      "payments.external.PaymentAuthorized": {
        "summary": "The payment of a reference was authorized.",
        "headers": {
          "properties": {
            "message-type": { "const": "payments.external.PaymentAuthorized" }
          }
        },
        "payload": { "...": "the fields: referenceId, paymentId, authorizedAt" }
      }
    }
  }
}
```

It says: the payments module _sends_ `PaymentAuthorized` on the `payments-responses` channel, what that message means, the headers it travels with, and its fields. The full document has every channel, operation and message of the module. The AsyncAPI page, from [step 8 of the how-to](./HOWTO.md#8-read-the-messages-on-the-asyncapi-page), shows such a document as a page.

One document describes one module. But some questions span all modules: "who reads `PaymentFailed`?", "what does the orders module depend on?", "which team owns the shipments?". [EventCatalog](https://www.eventcatalog.dev/) answers them. It is a tool that reads many OpenAPI and AsyncAPI documents and builds one website from them. The website shows each module as a _service_, every message with the services that send and receive it, diagrams of how the services connect, and the team that owns each service:

![The Payments service in EventCatalog](./assets/howto/11-eventcatalog-service.png)

#### Writing the documents from the code

The sample writes the documents from the code, so they can't drift from it:

- **OpenAPI**, for the web API. Each module with endpoints declares its routes with [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)'s `createRoute`, with Zod schemas for the parameters and the bodies, and serves them with `api.openapi(route, handler)`. So the document and the served routes are the same code. The application serves the whole document at `/openapi.json`, and one for each module at `/openapi/modules/{module}`.
- **AsyncAPI**, for the messages. [asyncApiDocument.ts](./packages/application/src/documentation/asyncApiDocument.ts) builds the document from the modules' message routes, in [channelFlows.ts](./packages/application/src/documentation/channelFlows.ts), and from a Zod contract for each message, in each module's contracts file, such as [paymentContracts.ts](./packages/application/src/payments/paymentContracts.ts). Each contract describes its message once. The application serves the whole document at `/asyncapi.json`, and one for each module at `/asyncapi/modules/{module}`.

A few details shape the documents:

- a module receives from its own queue, so a receive operation points at a channel named after the queue, such as `orders-payments-responses`, whose description names the channel it is bound to;
- each module's document has the operations of its own code: `AuthorizePayment` shows twice, in the orders document as a message that the order workflow sends to `payments-requests`, and in the payments document as a message that the payment workflow receives there;
- each message has `x-eventcatalog-message-type`: `command` or `event`. AsyncAPI has only messages, and EventCatalog reads this field to tell commands from events. In the web API, a `GET` is a query and every other method a command;
- each document lists three servers: `kafka`, `rabbitmq` and `in-memory`. The channels are the same on all of them, so the document doesn't change with `MESSAGING_BUS`;
- the payload is the message's data, and the type travels in the `message-type` header, as on Kafka and RabbitMQ;
- the **Publish a message** page, at `/asyncapi/publish`, checks a message against its contract and sends it to its channel, as an outside system would.

The contracts also guard their snapshots: [contractGuards.unit.spec.ts](./packages/application/src/documentation/contractGuards.unit.spec.ts) checks that on CI a missing snapshot fails instead of being written, that a snapshot without a contract fails, and that a message with optional fields has its `required-only` snapshot.

#### Building the catalog from the documents

The catalog lives in the [eventcatalog](./eventcatalog/) folder, a Node.js package of its own. `npm --prefix eventcatalog run build` does the three steps below:

1. **Save the documents.** [exportSpecs.mjs](./eventcatalog/exportSpecs.mjs) builds the application in the same process, without starting it, and saves the six documents (two OpenAPI, four AsyncAPI) to `eventcatalog/specs`.
2. **Write the catalog's pages.** EventCatalog's two generators, `@eventcatalog/generator-openapi` and `@eventcatalog/generator-asyncapi`, read the saved documents and write one Markdown page for each service and each message to [eventcatalog/domains](./eventcatalog/domains/). [eventcatalog.config.js](./eventcatalog/eventcatalog.config.js) tells them which document belongs to which service, and which subdomain each service belongs to. Each module is a bounded context, so each one gets its own subdomain, named after the module. Its service is the module's id with `-service`, as in EventCatalog's examples, because a subdomain and a service can't share an id:

   ```js
   const modules = [
     {
       id: 'shopping-carts',
       name: 'Shopping carts',
       spec: 'shopping_carts',
       web: true,
     },
     { id: 'orders', name: 'Orders', spec: 'orders', web: true },
     // ...
   ];
   ```

3. **Build the website.** Astro, the site builder under EventCatalog, turns the pages into a static website in `eventcatalog/dist`. `npm --prefix eventcatalog run preview` serves it on <http://localhost:3001>.

The generators connect the documents like this:

- **A module becomes a service.** The shopping carts and orders modules have two documents each, OpenAPI and AsyncAPI. Both map to the same service id, so the service shows the module's endpoints and its messages together.
- **Operations become "sends" and "receives".** An operation with `"action": "send"` makes the message one that the service sends, and `"action": "receive"` one that it receives.
- **The same message name links the sender to the receiver.** Each message is named after its type. The payments document has `payments.external.PaymentAuthorized` in a `send` operation, and the orders document has the same name in a `receive` operation. So the catalog shows that payments sends `PaymentAuthorized` to orders. This is why each module's document also has the messages it receives from other modules.
- **`x-eventcatalog-message-type` sorts the messages** into commands, events and queries.
- Each message's page is stored under the service that sends it: `payments.AuthorizePayment` is in `orders-service/commands`, because the order workflow sends it.
- **Each channel gets a page**, in [channels](./eventcatalog/channels/), with its address and the protocols that carry it: `parseChannels: true` in the configuration turns this on.

#### How the modules fit together

The generated pages describe each module on its own: its endpoints and its messages. They don't say how the modules depend on each other, how a purchase goes through them, or what their words mean. No document in the code holds that, so this sample writes those pages by hand, in the same `eventcatalog` folder.

**The context map.** Each module is a _bounded context_: a part of the shop with its own model and its own words. A _context map_ shows how the contexts depend on each other. The sample uses the terms of [DDD-Crew's context mapping](https://github.com/ddd-crew/context-mapping):

- _upstream_ and _downstream_: the upstream context's changes affect the downstream one, and not the other way round;
- _open host service_ with a _published language_ (OHS + PL): the upstream context offers a documented contract that anyone can use. Here that's each module's commands and external events, documented in its AsyncAPI document;
- _anti-corruption layer_ (ACL): the downstream context translates the upstream model into its own, so the upstream model doesn't leak in. Here that's the order workflow for the orders module, and `PaymentGateway` and `WarehouseGateway` for the outside systems;
- _customer and supplier_: two teams where the downstream team's needs go into the upstream team's plans. Here the orders team is the customer of the payments and shipments teams.

EventCatalog draws the map itself, as its _system context map_. Each context has a system page, such as [orders-system](./eventcatalog/domains/orders/systems/orders-system/index.mdx), and so does each [outside system](./eventcatalog/systems/). A system page names its service, its `relationships`, with the pattern as the label, and the `actors` that use it. The [E-Commerce domain](./eventcatalog/domains/e-commerce/index.mdx) page explains each relationship.

![The context map in EventCatalog](./assets/howto/16-eventcatalog-context-map.png)

**The purchase flow.** The [purchase flow](./eventcatalog/domains/orders/flows/purchase/index.mdx) shows the steps of a purchase across the contexts, with what the shop undoes when a step fails. Its page also has the sequence diagrams from this README.

**Each context's own pages.** Each subdomain's page starts with a short overview, which the generators keep. Next to it:

- `ubiquitous-language.mdx` is the context's dictionary: its words, such as _hold_, _capture_ or _compensation_, and what each one means there;
- an _entity_ page describes the context's main state, such as the [order](./eventcatalog/domains/orders/entities/order/index.mdx): its fields and its state diagram. The order's `paymentId` and `shipmentId` point to the other entities, so EventCatalog's entity map draws those links.

**The data stores.** EventCatalog calls data stores _containers_. The [two of them](./eventcatalog/containers/) are the event store and the read models. Each module has its own of both, in its own database, and writes only its own streams and read models. Each service lists them in `writesTo` and `readsFrom`, and each system in `containers`.

#### Changing and checking the catalog

The catalog is documentation as code: the pages in `domains` are kept in the repository, next to the hand-written [teams](./eventcatalog/teams/) and [users](./eventcatalog/users/) that own the services. Each service's `owners` in `eventcatalog.config.js` names its team. When the generators run again, they update the pages from the documents, but keep what the pages already have: each service's owners, each message's badges, and messages that are no longer in the documents. So after you change a service's `owners`, or rename or remove a message, delete that service's folder, such as `domains/payments/services/payments-service`, and generate it again. Then add its `writesTo` and `readsFrom` back, as the other services have them. Don't delete the whole `domains` folder: it holds the hand-written pages too.

`npm run test:eventcatalog` builds the catalog and checks it in Chromium with [Playwright](https://playwright.dev/), in [catalog.spec.js](./eventcatalog/tests/catalog.spec.js). It checks that:

- the context map and the domain diagram draw the four contexts, and each subdomain holds its module and has its dictionary;
- each entity page lists the state and draws its states, and the entity map links the entities;
- the event store shows every module, a channel page shows its address, and the purchase flow has its steps and diagrams;
- each service lists what it sends and receives and shows its team, and the listings have every command, event and query;
- each document's page shows its endpoints or channels, and the browser reports no errors.

The CI build runs it and fails when the pages don't match the code.

### Where the code lives

The sample is an npm workspace with two packages. [packages/application](./packages/application/) is the shop, and [packages/core](./packages/core/) the code that knows nothing about the shop.

Each module keeps its state and events, its commands, its workflow or decider, its configuration (routes, channels and queues), its processors and its web API at the top of its folder, such as [orders](./packages/application/src/orders/). The small types that only make sense with their state live in the same file, as Emmett keeps them: `OrderId`, `PaymentId`, `ShipmentId` and their URN rules. The payment provider's types live in `paymentGateway.ts`. Everything else sits in a feature folder named after what it does in the business. A read model that a query reads sits in a folder named after the query:

| Module         | Feature folders                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| orders         | `getCustomerOrders`, `getOrderStatus`, `unpaid` (the orders waiting for the customer to pay again), `external` (the forwarder of the order's requests), `contracts`                           |
| payments       | `authorization` (the provider calls around the Checkout Session, the time-out and the expiry), `capture`, `external`, `sandbox` (the payment provider when the application runs), `contracts` |
| shipments      | `fulfillment` (the warehouse and the fulfillment service), `external`, `sandbox` (the warehouse and its page when the application runs), `contracts`                                          |
| shopping carts | `getCart`, `currentCart` (the customer's open cart), `pricing`, `external`, `contracts`                                                                                                       |

`external` holds the module's external events and its forwarder, and for the cart the summary projection that the forwarder reads. `contracts` holds the approved snapshots of its messages. Each module serves its own pages next to its web API. The `shop` folder, next to the modules, holds only what the pages share: the login, the page layout and the demo products. Shipments has no web API, because no person sends it a command: the customer sees the carrier and the tracking number on the order status page. The application's root holds the composition: [application.ts](./packages/application/src/application.ts), [buildApplication.ts](./packages/application/src/buildApplication.ts), [settings.ts](./packages/application/src/settings.ts), [eventStore.ts](./packages/application/src/eventStore.ts), [messaging.ts](./packages/application/src/messaging.ts) and [server.ts](./packages/application/src/server.ts), with [documentation](./packages/application/src/documentation/) and [telemetry](./packages/application/src/telemetry/) next to them.

[packages/core](./packages/core/src/) holds the messaging, with the channel streams and an implementation in each of `messaging/kafka` and `messaging/rabbitmq`, the conditional and long-polling HTTP reads (`http`), the URNs (`identifiers`), the workers' loop (`workers`), and the testing helpers (`testing`), with `ApiE2ESpecification`. The Grafana dashboards live in [observability/dashboards](./observability/dashboards). The tests sit next to the code they test, and the tests of a whole purchase, which cross the modules, sit at the application's root.

### Known issues

The sample runs on Emmett 0.43.0-rc.3. A few Emmett bugs are fixed on branches but not released yet. None of them breaks the sample's tests:

- [#432](https://github.com/event-driven-io/emmett/issues/432): a message that a consumer's processor appends doesn't run the store's inline projections. The sample doesn't depend on it, because the read models fed by the workflows run as projectors.
- [#434](https://github.com/event-driven-io/emmett/issues/434): a workflow with a separate inbox can decide an input it has already handled again.
- [#438](https://github.com/event-driven-io/emmett/issues/438): there is no retry policy for processors yet. On SQLite, a forwarder that retries holds its database's write lock, so the module's other writes wait.

### What this sample doesn't cover

- **There is no real sign-in.** The login asks only for a name, and the customer id is part of the URL. A real shop takes the customer from the signed-in account.
- **There is no delivery and payment form.** On Shopify, the customer chooses the delivery and the payment method after "Check out", and the order is placed only at "Pay now". Here `CheckOutShoppingCart` places the order at once, and the provider's page offers the payment methods.
- **There are no webhook endpoints.** The payment provider and the fulfillment service answer through the sandboxes when the application runs, and through named fakes in the tests, storing the inputs their webhooks would cause.
- **Carts are never anonymous.** The customer is logged in from the first product, as on Allegro. Shopify and WooCommerce also let a guest fill a cart and merge it into the account's cart at login.
- **A rejected fulfillment request cancels the order.** A real shop gives the order back to the merchant, who can try another warehouse.
- **The order does not wait for the delivery.** A delivery that never happens has no consequence for the order.
- **A sent package has no return path.** Returns and refunds are a process of their own.
- **Partial reservations do not exist.** A reservation covers every product or none.
- **Money is a `number`.** Prices and totals are rounded to whole cents. A real shop would use a decimal type and a currency.
