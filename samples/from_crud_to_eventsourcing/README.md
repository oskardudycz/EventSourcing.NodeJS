## From CRUD to Event-Sourced application

<a href="https://www.architecture-weekly.com/p/webinar-1-from-crud-to-event-sourcing" target="_blank"><img src="https://substackcdn.com/image/fetch/w_1920,h_1080,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-video.s3.amazonaws.com%2Fvideo_upload%2Fpost%2F69390705%2Fd71d5510-0aca-4fa9-aa6e-01fbbf29ac1d%2Ftranscoded-00002.png" alt="vent-Driven revolution, from CRUD to Event Sourcing" width="600" height="338" border="10" /></a>

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
4. The customer can confirm the shopping cart and start the order fulfillment process.
5. The customer may also cancel the shopping cart and reject all selected products.
6. After shopping cart confirmation or cancellation, the product can no longer be added or removed from the cart.

## CRUD application

The current application is a NodeJS monolith application. It has two endpoints:

- insert/update - used for all the business operations, updates database state with the new values,
- get - returns the current shopping cart state.

The assumption to have such a generic approach was that we're using a rich front-end Single Page Application that drives the business logic. For such a case, it may be reasonable just to validate data from the client and put them into the database. It also assumes that the database will enforce invariants/constraints. It may be valid in the first phase, where workflow is simple, and we do not require more sophisticated business logic and are fine with losing business context on each update.

## Prerequisites

1. Install git - https://git-scm.com/downloads.
2. Clone this repository.
3. Install latest NodeJS - https://nodejs.org/en/download/.
4. Install IDE, e.g. VSCode.
5. Install docker - https://docs.docker.com/engine/install/.
6. Open current folder.

## Running

### Docker

1. Run: `docker compose up`.
2. Wait until all dockers got are downloaded and running.
3. You should automatically get:
   - Postgres DB
   - PG Admin - IDE for postgres. Available at: http://localhost:5050.
     - Login: `admin@pgadmin.org`, Password: `admin`
     - To connect to server click right mouse on Servers, then Register Server and use host: `postgres`, user: `postgres`, password: `postgres`
   - EventStoreDB UI: http://localhost:2113/

### CRUD

1. Call command bellow to setup database for CRUD example:

```shell
npm run crud:setup
```

2. Run command bellow to start CRUD application:

```shell
npm run crud:start
```

### Event-Sourced

1. Call command bellow to setup database for Event-Sourced example:

```shell
npm run eventsourced:setup
```

2. Run command bellow to start CRUD application:

```shell
npm run eventsourced:start
```
