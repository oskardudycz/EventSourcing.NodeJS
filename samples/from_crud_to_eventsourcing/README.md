[<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/oskardudycz/) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_nodejs) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_nodejs)

# From CRUD to Event-Sourced application

<a href="https://www.architecture-weekly.com/p/webinar-1-from-crud-to-event-sourcing" target="_blank"><img src="https://substackcdn.com/image/fetch/w_1920,h_1080,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-video.s3.amazonaws.com%2Fvideo_upload%2Fpost%2F69390705%2Fd71d5510-0aca-4fa9-aa6e-01fbbf29ac1d%2Ftranscoded-00002.png" alt="Event-Driven revolution, from CRUD to Event Sourcing" width="600" height="338" border="10" /></a>

## Overview

Nowadays, storage is cheap, but the information is priceless. Event sourcing is a valuable pattern that gives you more options around running, tracking and understanding the business workflow. This sample shows how you could benefit and migrate from the traditional approach.

## Business scenario

Imagine that the company you work for has an efficiently developed ECommerce platform. The business situation looks so stable that the business is looking for new opportunities. Your current system is now made classically: monolith in Cloud, normalized relational base, ORM, etc.

The business concluded that the information about the final state of the shopping cart is not sufficient. Having the entire workflow history, it would be possible to analyze better the operations performed by the user (e.g. analysis of related products, products taken out of the basket, abandoned baskets, etc.). The business also wants to handle diagnostics and support better to solve reported problems.

The sample focuses on the specific shopping cart workflow, assuming you can reuse the strategies for other functionalities accordingly.

Having the following shopping cart process:

1. The customer may add a product to the shopping cart only after opening it.
2. When selecting and adding a product to the basket customer needs to provide the quantity chosen. The system calculates the product price based on the current price list.
3. The customer may remove a product from the cart.
4. The customer can confirm the shopping cart and start the order fulfilment process.
5. The customer may also cancel the shopping cart and reject all selected products.
6. After shopping cart confirmation or cancellation, the product can no longer be added or removed from the cart.

## CRUD application

The current application is a NodeJS monolith application. It has two endpoints:

- insert/update - used for all the business operations, updates database state with the new values,
- get - returns the current shopping cart state.

The assumption to have such a generic approach was that we're using a rich front-end Single Page Application that drives the business logic. For such a case, it may be reasonable just to validate data from the client and put them into the database. It also assumes that the database will enforce invariants/constraints. It may be valid in the first phase, where workflow is simple, and we do not require more sophisticated business logic and are fine with losing business context on each update.

See the [crud](./src/crud/) folder. Endpoints are available under `/shopping-carts/:sessionId`. It uses [TypeORM](https://typeorm.io/): the tables are mapped in [cart.ts](./src/db/cart.ts) and created by the [initial migration](./src/db/migrations/1672531200000-InitialMigration.ts).

## Event-Sourced application

The [eventsourced](./src/eventsourced/) folder shows the same shopping cart after the migration:

- each business operation has its own endpoint under `/v2/` and is recorded as an event (`shopping-cart-opened`, `product-item-added-to-shopping-cart`, `product-item-removed-from-shopping-cart`, `shopping-cart-confirmed`) in the shopping cart stream,
- the business logic is a decider: `decide` turns a command into an event, `evolve` builds the state from events, see [shoppingCart.ts](./src/eventsourced/shoppingCarts/shoppingCart.ts). Emmett's `DeciderCommandHandler` loads the state, runs `decide` and appends the event with optimistic concurrency based on the `If-Match` header,
- the Web API uses Emmett's Express.js helpers, which also map errors to Problem Details, for example a change to a confirmed cart returns `403` and a stale ETag returns `412`, see [api.ts](./src/eventsourced/shoppingCarts/api.ts),
- events are stored in the same PostgreSQL database by [Emmett](https://event-driven-io.github.io/emmett/), which creates its own tables, see [eventStore.ts](./src/eventsourced/core/eventStore.ts),
- the existing CRUD tables become the read model. An inline projection updates them with raw SQL in the same transaction that appends the events, so reads are up to date right after each command, see [shoppingCartDetails.ts](./src/eventsourced/shoppingCarts/shoppingCartDetails.ts),
- reads still go through TypeORM, the same way as in the CRUD application. The ETag comes from the stream version in Emmett.

## Prerequisites

1. Install git - https://git-scm.com/downloads.
2. Clone this repository.
3. Install Node.js in the version from [.nvmrc](./.nvmrc) (or better using NVM).
4. Install IDE, e.g. VSCode.
5. Install docker - https://docs.docker.com/engine/install/.
6. Open current folder.
7. Install packages: `npm install`.

## Running

### Docker

1. Run: `docker compose --profile all up`.
2. Wait until all containers are downloaded and running.
3. You should automatically get:
   - Postgres DB
   - PG Admin - IDE for postgres. Available at: http://localhost:5050.
     - Login: `pgadmin4@pgadmin.org`, Password: `admin`
     - To connect to server click right mouse on Servers, then Register Server and use host: `postgres`, user: `postgres`, password: `postgres`

### CRUD

Run command below to start CRUD application. It runs the database migrations on start:

```shell
npm run crud:start
```

### Event-Sourced

Run command below to start Event-Sourced application. It runs the same database migrations on start, and Emmett creates its tables when it is first used:

```shell
npm run eventsourced:start
```

Both applications listen on http://localhost:5000.

### Tests

Run `npm test`. The Event-Sourced application has tests on each level, all using Emmett's testing tools:

- unit tests of the business logic with `DeciderSpecification`, see [shoppingCart.unit.test.ts](./src/eventsourced/shoppingCarts/shoppingCart.unit.test.ts),
- API tests with `ApiSpecification` on the in-memory event store, see [api.api.test.ts](./src/eventsourced/shoppingCarts/api.api.test.ts),
- integration tests of the projection with `PostgreSQLProjectionSpec`, see [shoppingCartDetails.int.test.ts](./src/eventsourced/shoppingCarts/shoppingCartDetails.int.test.ts),
- end-to-end tests with `ApiE2ESpecification`, where each scenario sets up the earlier steps of the flow as requests in `given`. Both applications have the same scenarios and expect the same shopping cart details after each step, so you can compare the [CRUD](./src/crud/e2e/fullFlow.e2e.test.ts) and the [Event-Sourced](./src/eventsourced/e2e/fullFlow.e2e.test.ts) versions side by side.

Integration and end-to-end tests start PostgreSQL through [Testcontainers](https://testcontainers.com/), so they need Docker running.

To see the data that tests store, start Docker Compose as described in [Docker](#docker). The tests then use its PostgreSQL automatically instead of starting their own. Stop Docker Compose to go back to Testcontainers.
