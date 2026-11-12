[<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/oskardudycz/) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_jvm) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_net)

# Event-Driven Architecture Workshop

Event-Driven Architecture sounds like a buzzword, but it's a practical way to build systems where modules react to what happened instead of calling each other directly. It's also easy to get wrong: lost messages, broken processes and no idea why a customer ended up in a weird state.

The workshop builds that knowledge step by step on a single domain, a hotel's guest stays and group checkouts. You start with modelling events and entities, then coordinate a business process across modules and make it survive duplicates, parallel updates and failures.

1. Events and entities: modelling what happened and the state that decides what can happen next.
2. Commands and events: intent versus facts.
3. Business processes: choreography, process managers and sagas, with their trade-offs.
4. Idempotency: handling the same message more than once without changing the outcome.
5. Optimistic concurrency: not losing changes when handlers update the same entity in parallel.
6. Consistency: not losing state changes or events when the database or the message bus fails, using the transactional outbox.

You can do the workshop as a self-paced kit. If you'd like to get full coverage with all nuances of the private workshop, check [training page on my blog for more details](https://event-driven.io/en/training/) or feel free to contact me via [email](mailto:oskar@event-driven.io).

## Exercises

Follow the instructions in the exercise folders.

1. [Events definition](./src/01_events_definition/).
2. [Entities definition](./src/02_entities_definition/).
3. [Business processes](./src/03_business_processes/).
4. [Idempotency](./src/04_idempotency/).
5. [Optimistic concurrency](./src/05_optimistic_concurrency/).
6. [Consistency](./src/06_consistency/).

Each exercise has a full implementation in the [solved](./src/solved/) folder. Some go further than the exercise:

- [Business processes](./src/solved/03_business_processes/regular/): sagas, process managers and choreography.

## Prerequisites

1. Install git - https://git-scm.com/downloads.
2. Clone this repository.
3. Install Node.js 24.22.1 or later - https://nodejs.org/en/download/ (or better using NVM, the version is in [.nvmrc](./.nvmrc)).
4. Install VSCode, WebStorm or other preferred IDE.
5. Open the current folder in IDE.

Everything runs in memory, so you don't need Docker.

## Setup

1. Install NPM packages by running: `npm install`.
2. Build source codes: `npm run build`.
3. Run `npm run test:solved`. If all is fine then all tests should be green.

## Running

1. To run the tests of the exercises, run `npm run test:exercises`. For solutions run `npm run test:solved`.
2. To run the tests of the exercise you're working on, pass its folder, e.g. `npx vitest run src/01_events_definition`.
3. When you're working on an exercise and want the tests to rerun on file change, run `npm run test:exercises:watch`.
4. You can get build watch by running `npm run build:ts:watch`.
