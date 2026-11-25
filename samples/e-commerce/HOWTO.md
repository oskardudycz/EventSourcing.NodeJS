# Try the e-commerce sample

This guide takes you through one purchase in the sample shop, step by step. After it, you look at the same purchase from the inside: the web API in Swagger UI, the messages in the AsyncAPI page, the whole system in EventCatalog, and the traces, metrics, logs and alerts in Grafana. The [README](./README.md) explains what happens in each step and why.

- [Try the e-commerce sample](#try-the-e-commerce-sample)
  - [What you need](#what-you-need)
  - [1. Start the application](#1-start-the-application)
  - [2. Log in](#2-log-in)
  - [3. Add products to the cart](#3-add-products-to-the-cart)
  - [4. Check out](#4-check-out)
  - [5. Pay on the payment provider's page](#5-pay-on-the-payment-providers-page)
  - [6. Send the package and see the completed order](#6-send-the-package-and-see-the-completed-order)
  - [7. Call the web API in Swagger UI](#7-call-the-web-api-in-swagger-ui)
  - [8. Read the messages on the AsyncAPI page](#8-read-the-messages-on-the-asyncapi-page)
  - [9. Make a payment or a shipment fail](#9-make-a-payment-or-a-shipment-fail)
  - [10. Browse the catalog in EventCatalog](#10-browse-the-catalog-in-eventcatalog)
  - [11. Look at the purchase in Grafana](#11-look-at-the-purchase-in-grafana)
  - [12. Run the tests](#12-run-the-tests)

## What you need

- Node.js 24.22.1 or newer, the version in [.nvmrc](./.nvmrc). With [nvm](https://github.com/nvm-sh/nvm), run `nvm install` and `nvm use` in this folder.
- Docker. Docker Compose runs Kafka, PostgreSQL and Grafana for the application. The tests start their servers in it too. Without Docker you can still run the application on SQLite without a broker (step 1).

Run all commands in this folder, `samples/e-commerce`. Install the packages once with `npm install`.

## 1. Start the application

```shell
docker compose --profile sample up -d --wait
npm start
```

The first command starts the sample's Docker Compose services: Kafka, PostgreSQL and Grafana LGTM. The first start pulls their images, which takes a few minutes. The second starts the application on port 8080. The application runs the shop's four modules (shopping carts, orders, payments and shipments), a payment provider and a warehouse. Kafka carries the messages between the modules, and PostgreSQL keeps each module's events and read models, in a schema of its own.

Environment variables change that, for example `MESSAGING_BUS=rabbitmq npm start`:

| Setting           | Values                                             | Default                                                |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `MESSAGING_BUS`   | `in-memory`, `none`, `kafka`, `rabbitmq`           | `kafka`                                                |
| `EVENTSTORE_TYPE` | `sqlite`, `postgresql`                             | `postgresql`                                           |
| `SQLITE_FOLDER`   | a folder for the SQLite files, one for each module | a temporary folder, removed when the application stops |
| `PORT`            | the port of the shop and the web API               | `8080`                                                 |

With `MESSAGING_BUS=rabbitmq`, start RabbitMQ too: `docker compose --profile rabbitmq up -d --wait`. The README lists [the other settings](./README.md#running-the-application).

If you ran an older version of the sample, its queues, tables and stored events have an older shape. Remove the Docker Compose data once with `docker compose --profile all down -v`, in this folder.

To run with no Docker and no broker, use SQLite without a broker. Each module gets a SQLite file, and the modules pass their messages by appending them to each other's files. Without `SQLITE_FOLDER`, the data is gone when you stop the application:

```shell
MESSAGING_BUS=none EVENTSTORE_TYPE=sqlite npm start
```

To stop the Docker Compose services, run `docker compose --profile all down` in this folder.

The payment provider and the warehouse are _sandboxes_: small stand-ins for the real services, built into the application. The sandbox payment provider shows a payment page like Stripe's and accepts Stripe's test card numbers. The sandbox warehouse has a page where you send packages and change the stock. They let you go through a whole purchase without an account at a real provider.

## 2. Log in

Open <http://localhost:8080/shop>.

![The login page](./assets/howto/1-login.png)

Type any name and click **Log in**. There is no password. The shop makes the customer id from the name, so the same name always gives you the same cart and the same orders. To start as a different customer, click **Log out** in the header and log in with another name.

## 3. Add products to the cart

The shop opens the **Products** page. The header has links to your **Products**, **Cart** and **Orders**. **Developer tools** opens links to Grafana (step 11), Swagger UI (step 7), the AsyncAPI page (step 8), EventCatalog (step 10) and the sandbox warehouse (step 6). The header also shows your name.

![The products page](./assets/howto/2-products.png)

Click **Add to cart** on two products. After each click, the shop shows your cart. To add the second product, go back to **Products**.

![The cart with two products](./assets/howto/3-cart.png)

## 4. Check out

Click **Check out**. The shop opens the **Order status** page of your new order.

![The order waits for the payment](./assets/howto/4-order-awaiting-payment.png)

The order shows **Awaiting payment**. In the moment between the click and this page, the modules have exchanged messages:

1. The shopping carts module recorded that you checked out and told the orders module.
2. The orders module placed the order.
3. The orders module asked the payments module for a payment, and asked the shipments module to set aside your products in the warehouse.
4. The warehouse set the products aside and answered.

The payment can't go further without you. Only you can enter your card details.

## 5. Pay on the payment provider's page

Click **Pay now**. The shop sends you to the payment provider's page. This is the sandbox page.

![The sandbox payment page](./assets/howto/5-sandbox-checkout.png)

Click the card number field and pick `4242 4242 4242 4242`, the test card that pays, or type it. Then click the **Pay** button, which shows the amount. You can leave the other fields empty.

To see a declined card, pick `4000 0000 0000 0002` instead. The page says the card was declined, and you can try again, as on Stripe's page.

## 6. Send the package and see the completed order

After the payment, the payment provider sends you back to the **Order status** page. The order shows **Processing**: it waits for the warehouse. Meanwhile:

1. The payment provider told the payments module that you authorized the payment. Authorized means that the provider keeps the amount for the shop, but doesn't charge you yet.
2. The payments module told the orders module. Because the products were already set aside, the order was confirmed.
3. The orders module asked the shipments module to send the products, and the shipments module asked the warehouse.

Open **Developer tools** › **Sandbox warehouse** in a new tab. Your package waits there:

![The sandbox warehouse page](./assets/howto/6-sandbox-warehouse.png)

Click **Send**. Go back to the order tab: the page updates by itself.

![The completed order](./assets/howto/6-order-completed.png)

The order shows **Completed**, with the carrier and the tracking number. After the package left, the orders module asked the payments module to charge you. The payment provider confirmed the charge, and the order completed. The shop charges only for what it sent.

The **Orders** page lists all your orders.

![The orders page](./assets/howto/7-orders.png)

## 7. Call the web API in Swagger UI

The shop pages call the same code as the web API. Open Swagger UI at <http://localhost:8080/swagger>.

![Swagger UI](./assets/howto/8-swagger-ui.png)

The OpenAPI document lists the endpoints of the modules that have them, `shopping_carts` and `orders`: what each endpoint takes and what it returns. The application builds it from the same route definitions that serve the requests, so it can't drift from them. The document itself is at <http://localhost:8080/openapi.json>. To call an endpoint:

1. Open it and click **Try it out**.
2. For `customerId`, use your customer id. It is the part after `/customers/` in the address of any shop page.
3. Click **Execute**.

For example, `GET /customers/{customerId}/orders` returns the orders that you placed in the shop.

## 8. Read the messages on the AsyncAPI page

The modules talk through messages, which have no URLs to call. A module publishes its messages on named _channels_, such as `payments-internal`, and other modules receive them from there. An AsyncAPI document describes them: each channel, the messages on it, which module sends or receives them, and what each message means. The application writes this document from the modules' message routes and their schemas, and the AsyncAPI page shows it. [Documenting the messages](./README.md#documenting-the-messages) explains both. Open <http://localhost:8080/asyncapi>.

![The AsyncAPI page](./assets/howto/9-asyncapi-ui.png)

The page shows the document of the whole system, which is also at <http://localhost:8080/asyncapi.json>. Each module also has its own document, at `/asyncapi/modules/shopping_carts`, `/asyncapi/modules/orders`, `/asyncapi/modules/payments` and `/asyncapi/modules/shipments`.

**Publish a message**, at the top of the page, opens a form that sends a message to the application's message bus. It checks the message against its schema first. The module handles it like any other message. The next step uses it.

## 9. Make a payment or a shipment fail

In a real shop, a payment fails when the customer doesn't pay in time. In the sample, that time is 24 hours. You can make it happen at once, by sending the message that the payments module sends itself when the time runs out.

1. Add a product to the cart and check out, but don't pay.
2. Find the order's id: open `http://localhost:8080/customers/<your customer id>/orders/1`, where your customer id is the part after `/customers/` in the address of any shop page, and copy its `orderId` without `urn:ecommerce:order:`. It looks like `b7313efd-c0b2-3d42-bdf9-3eb4c7a5c2af-1`. The payment has the same id.
3. Open the AsyncAPI page, as in [step 8](#8-read-the-messages-on-the-asyncapi-page), and click **Publish a message**.
4. Choose `payments.TimeOutPayment`. In its data, set `paymentId` to `urn:ecommerce:payment:` followed by the order's id, and set `timedOutAt` to a date at least 24 hours later than now. The payment ignores a time-out that comes before its deadline.
5. Click **Publish**.

Reload the **Order status** page. The order now shows **Payment failed** and offers **Retry payment**. The order keeps your products set aside and waits for you to pay again.

You can make a shipment fail on the sandbox warehouse page:

- **Out of stock.** Add **Limited edition trail shoes** to the cart and check out. The warehouse doesn't have them, so the order shows **Out of stock** and offers only **Cancel order**. To try it with another product, click **Mark out of stock** next to it on the warehouse page.
- **Rejected.** Pay for an order, then click **Reject** next to its package. The order is canceled: the payments module releases the money it held, and the shipments module puts the products back.

## 10. Browse the catalog in EventCatalog

EventCatalog builds a website from the OpenAPI and AsyncAPI documents. To build and open it, run:

```shell
npm --prefix eventcatalog install
npm --prefix eventcatalog run build
npm --prefix eventcatalog run preview
```

The build writes the application's documents to `eventcatalog/specs`, without starting the application, and builds the catalog from them. Then open <http://localhost:3001>. The first install takes a few minutes.

![The catalog's home page](./assets/howto/10-eventcatalog-home.png)

The catalog shows the E-Commerce domain with four subdomains, one for each module. Each subdomain is a bounded context. **Top level diagrams** › **System Context Diagram** is the context map: the contexts, the customer and the two outside systems, with the pattern of each relationship. The E-Commerce page explains the patterns.

![The context map in the catalog](./assets/howto/16-eventcatalog-context-map.png)

The domain's **Diagram** draws the messages between the contexts, from the documents. **Flows** › **Purchase** walks through the purchase step by step, with what the shop undoes when a step fails. Each subdomain also has its dictionary of terms, under **Ubiquitous language**, and a page for its aggregate, such as **Order**, with its state and its state diagram.

![The domain diagram in the catalog](./assets/howto/17-eventcatalog-domain-diagram.png)

Each module is a service in its subdomain. A service page shows what the module receives and sends, and which team owns it.

![The Payments service in the catalog](./assets/howto/11-eventcatalog-service.png)

**Discover** lists all commands, events and queries. For each event, it shows which module produces it and which consumes it.

![The events in the catalog](./assets/howto/12-eventcatalog-events.png)

## 11. Look at the purchase in Grafana

The application reports what it does as _traces_, _metrics_ and _logs_. A trace follows one request through every module, as a tree of _spans_: one span for each step, with the time it took. Metrics count and time what happens. Logs are the application's log lines. [Seeing what happens](./README.md#seeing-what-happens-traces-metrics-and-logs) explains them.

The `sample` profile of step 1 runs Grafana LGTM with the other Docker Compose services: Grafana, with Tempo for the traces, Prometheus for the metrics and Loki for the logs. Without the broker and the database, start only it with `docker compose --profile otel up -d`. The application sends to `http://localhost:4318`, or to the `OTEL_EXPORTER_OTLP_ENDPOINT` setting. After a purchase, open Grafana at <http://localhost:3000>. It needs no login. If Grafana doesn't run, the application works the same.

### Find the purchase's traces

Each step of a purchase has traces of its own: the HTTP request, and each consumer and workflow that handles a message on the way. Emmett starts a new trace for each message that a consumer handles, and links it to the trace of the request that caused it. Open **Explore**, choose the **Tempo** data source and search with TraceQL, for example `{ resource.service.name = "e-commerce" }`. Open a trace and follow its links to the next steps.

To see the log lines, choose the **Loki** data source in **Explore** and query `{service_name="e-commerce"}`.

### Read the dashboards

Open **Dashboards**. Three dashboards come with the sample.

**Purchases** counts what customers do and what goes wrong, from the events that the modules append: the orders placed, completed, canceled and closed unpaid, and the payments and shipments. Under **Watch out**, it shows the failed commands, timeouts, dead letters, failed message handlers and the lag. **Dead letters** and **Failed message handlers** show "No data" until a message fails.

![The Purchases dashboard](./assets/howto/13-grafana-purchases.png)

Scroll down to **Business**. It shows the numbers a shop owner asks about: how many checkouts became orders, how many orders got paid, how many payments failed, how many reservations found a product out of stock, the revenue and the average order value, how many orders are still running or wait for the customer to pay again, and how long an order takes to be paid, sent and completed.

![The Business row of the Purchases dashboard](./assets/howto/18-grafana-business.png)

**Commands and event store** shows how the command handlers and the event store work: the commands by status, their latency, the events appended by type, the appends and their latency, the HTTP requests, the lag, and how long processors and workflows take.

![The Commands and event store dashboard](./assets/howto/14-grafana-commands-and-event-store.png)

**Purchase flow** shows the messages published, handled and failed in each channel, the dead letters and the HTTP requests.

![The Purchase flow dashboard](./assets/howto/15-grafana-purchase-flow.png)

### See the alert rules

Open **Alerting** › **Alert rules** and choose **List**. The folder **E-Commerce** holds the sample's eight rules. Each says what it watches, such as **Capture failed**: a package left the warehouse, but the provider refused to charge. A rule shows **Normal** while what it watches doesn't happen. **Capture failed**, **Money lost** and **Dead letters** fire at once, because each of them means one customer or one message needs a person. The other rules watch rates, so they show **Pending** first and fire only when the rate stays bad for 2 or 5 minutes, which a single slow moment doesn't do. The [alerts table](./README.md#seeing-what-happens-traces-metrics-and-logs) in the README lists when each one fires.

![The alert rules](./assets/howto/19-grafana-alert-rules.png)

To see one fire, time out five payments as in [step 9](#9-make-a-payment-or-a-shipment-fail), within 15 minutes. **Payments failing** counts the payments that timed out, failed to capture or expired. It needs at least five payments in the last 15 minutes, with more than 20% of them failed. Then it shows **Pending**, and after 5 more minutes **Firing**.

## 12. Run the tests

```shell
npm run build
npm test
```

`npm run build` runs ESLint, Prettier and the TypeScript compiler. `npm test` runs the unit, integration, API and end-to-end tests, in that order. The tests of the web API and the business logic run on SQLite. The tests of the Kafka, RabbitMQ and PostgreSQL implementations, and the tests that run a purchase on real servers, start their own servers with Testcontainers. The browser tests use Grafana LGTM from Docker Compose when it runs, so you can look at a test run there, and start their own when it doesn't.

The browser tests go through the purchase above in Chromium. Install it once with `npx --workspace packages/application playwright install --with-deps chromium`. One of them shops on Kafka and PostgreSQL, where the read models catch up after the writes. It checks that the pages never show an error while they wait, that the order page updates in place until the order is completed, and that the purchase reaches Grafana as traces, as metrics and as logs.

```shell
npm run test:eventcatalog
```

This builds the catalog and checks it in Chromium: each service lists what it sends and receives and shows its team, the listings have every command, event and query, and the browser reports no errors.

The screenshots in this guide come from the same tests. To take them again:

```shell
npm run screenshots
```
