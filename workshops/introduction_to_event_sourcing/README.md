[<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/oskardudycz/) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_jvm) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_net)

# Introduction to Event Sourcing Self-Paced Kit

Event Sourcing is perceived as a complex pattern. Some believe that it's like Nessie, everyone's heard about it, but rarely seen it. In fact, Event Sourcing is a pretty practical and straightforward concept. It helps build predictable applications closer to business. Nowadays, storage is cheap, and information is priceless. In Event Sourcing, no data is lost.

The workshop aims to build the knowledge of the general concept and its related patterns for the participants. The acquired knowledge will allow for the conscious design of architectural solutions and the analysis of associated risks.

The emphasis will be on a pragmatic understanding of architectures and applying it in practice using KurrentDB.

You can do the workshop as a self-paced kit. That should give you a good foundation for starting your journey with Event Sourcing and learning tools like KurrentDB.

**If you'd like to get full coverage with all nuances of the private workshop, check [training page on my blog for more details](https://event-driven.io/en/training/) feel free to contact me via [email](mailto:oskar@event-driven.io).**

Read also more in my article [Introduction to Event Sourcing - Self Paced Kit](https://event-driven.io/en/introduction_to_event_sourcing/?utm_source=event_sourcing_nodejs).

## Exercises

Follow the instructions in exercises folders.

1. [Events definition](./src/01_events_definition/).
2. [Getting State from events](./src/02_getting_state_from_events/).
3. Appending Events:
   - [Raw KurrentDB](./src/03_appending_events_kurrentdb/)
   - [Emmett with various storages (PostgreSQL, KurrentDB, MongoDB)](./src/04_appending_events_emmett/)
4. Getting State from events
   - [Raw KurrentDB](./src/05_getting_state_from_events_kurrentdb/)
   - [Emmett with various storages (PostgreSQL, KurrentDB, MongoDB)](./src/06_getting_state_from_events_emmett/)
5. Business Logic:
   - [Writing](./src/07_business_logic/)
   - [Testing](./src/08_business_logic_tests/)
6. Application logic:
   - [KurrentDB](./src/09_application_logic_kurrentdb/)
7. Optimistic Concurrency:
   - [KurrentDB](./src/10_optimistic_concurrency_kurrentdb/)
8. Projections:
   - [General](./src/11_projections_single_stream/)
   - [Idempotency](./src/12_projections_single_stream_idempotency/)
   - [Eventual Consistency](./src/13_projections_single_stream_eventual_consistency/)
   - [Emmett](./src/14_projections_single_stream_emmett/)
9. Business Processes:
   - [Events definition](./src/15_processes_events_definition/)
   - [Entities definition](./src/16_processes_entities_definition/)
   - [Business processes](./src/17_business_processes/)

## Prerequisites

1. Install git - https://git-scm.com/downloads.
2. Clone this repository.
3. Install Node.js 24.22.1 or later - https://nodejs.org/en/download/ (or better using NVM, the version is in [.nvmrc](./.nvmrc)).
4. Install VSCode, WebStorm or other prefered IDE.
5. Install docker - https://docs.docker.com/engine/install/.
6. Open the current folder in IDE.

## Setup

1. Install NPM packages by running: `npm install`.
2. Build source codes: `npm run build`.
3. If you're using VSCode, install the recommended extensions listed in [.vscode/extensions.json](./.vscode/extensions.json).

## Ensuring that all is setup correctly

1. Make sure Docker is running. Tests start KurrentDB, PostgreSQL and MongoDB containers on their own through Testcontainers.

2. Run `npm run test:solved`. If all is fine then all tests should be green.

## Running

1. Run: `docker compose up` to start KurrentDB Docker image.You should automatically get:

- KurrentDB UI: http://localhost:2113/
- Mongo Express UI: http://localhost:8081/
  - UI Credentials: login: `admin`, password: `pass`
- PgAdmin: http://localhost:5050/
  - UI Credentials: login: `admin@pgadmin.org`, password: `admin`
  - Database Credentials: host: `postgres`, login: `postgres`, password: `postgres`

2. You can get build watch by running `npm run build:ts:watch`.
3. To run test for exercises run `npm run test:exercises`. For solutions run `npm run test:solved`, for all `npm run test`.
4. Whe you're working with exercise and want to have tests running on file change run `npm run test:exercises:watch`.
