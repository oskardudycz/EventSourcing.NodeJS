[![Twitter Follow](https://img.shields.io/twitter/follow/oskar_at_net?style=social)](https://twitter.com/oskar_at_net) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_jvm) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_net)

# Introduction to Event Sourcing Workshop

Event Sourcing is perceived as a complex pattern. Some believe that it's like Nessie, everyone's heard about it, but rarely seen it. In fact, Event Sourcing is a pretty practical and straightforward concept. It helps build predictable applications closer to business. Nowadays, storage is cheap, and information is priceless. In Event Sourcing, no data is lost.

The workshop aims to build the knowledge of the general concept and its related patterns for the participants. The acquired knowledge will allow for the conscious design of architectural solutions and the analysis of associated risks.

The emphasis will be on a pragmatic understanding of architectures and applying it in practice using Marten and EventStoreDB.

1. Introduction to Event-Driven Architectures. Differences from the classical approach are foundations and terminology (event, event streams, command, query).
2. What is Event Sourcing, and how is it different from Event Streaming. Advantages and disadvantages.
3. Write model, data consistency guarantees on examples from Marten and EventStoreDB.
4. Various ways of handling business logic: Aggregates, Command Handlers, functional approach.
5. Projections, best practices and concerns for building read models from events on the examples from Marten and EventStoreDB.
6. Challenges in Event Sourcing and EDA: deliverability guarantees, sequence of event handling, idempotency, etc.
7. Saga, Choreography, Process Manager, distributed processes in practice.
8. Event Sourcing in the context of application architecture, integration with other approaches (CQRS, microservices, messaging, etc.).
9. Good and bad practices in event modelling.
10. Event Sourcing on production, evolution, events' schema versioning, etc.

You can do the workshop as a self-paced kit. That should give you a good foundation for starting your journey with Event Sourcing and learning tools like Marten and EventStoreDB. If you'd like to get full coverage with all nuances of the private workshop, feel free to contact me via [email](mailto:oskar.dudycz@gmail.com).

Read also more in my article [Introduction to Event Sourcing - Self Paced Kit](https://event-driven.io/en/introduction_to_event_sourcing/?utm_source=event_sourcing_nodejs).

## Exercises

Follow the instructions in exercises folders.

1. [Events definition](./src/01_events_definition/).
2. [Getting State from events](./src/02_getting_state_from_events/).
3. Appending Events:
   - [EventStoreDB](./src/03_appending_events_eventstoredb/)
4. Getting State from events
   - [EventStoreDB](./src/04_getting_state_from_events_eventstoredb/)
5. Business logic:
   - [General](./src/05_business_logic/)
   - [EventStoreDB](./src/06_business_logic_eventstoredb/)
6. Optimistic Concurrency:
   - [EventStoreDB](./src/07_optimistic_concurrency_eventstoredb/)
7. Projections:
   - [General](./src/08_projections_single_stream/)
   - [Idempotency](./src/09_projections_single_stream_idempotency/)
   - [Eventual Consistency](./src/10_projections_single_stream_eventual_consistency/)

## Prerequisites

1. Install git - https://git-scm.com/downloads.
2. Clone this repository.
3. Install Node.js 18 - https://Node.js.org/en/download/ (Or better using NVM).
4. Install VSCode, WebStorm or other prefered IDE.
5. Install docker - https://docs.docker.com/engine/install/.
6. Open the current folder in IDE.

## Setup

1. Install NPM packages by running: `npm install`.
2. Build source codes: `npm run build`.
3. If you're using VSCode, you may consider [importing profile](https://code.visualstudio.com/updates/v1_75#_profiles) from the [./.vscode/Node.js.code-profile](./.vscode/Node.js.code-profile) to get all recommended plugins.

## Ensuring that all is setup correctly

1. Run: `docker-compose up` to start EventStoreDB docker image.
2. Run `npm run test:solved`. If all is fine then all tests should be green.

## Running

1. Run: `docker-compose up` to start EventStoreDB docker image.You should automatically get EventStoreDB UI: http://localhost:2113/
2. You can get build watch by running `npm run build:ts:watch`.
3. To run test for exercises run `npm run test:exercise`. For solutions run `npm run test:solved`, for all `npm run test`.
4. Whe you're working with exercise and want to have tests running on file change run `npm run test:exercise:watch`.
