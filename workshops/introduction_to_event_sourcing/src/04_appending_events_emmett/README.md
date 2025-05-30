# Exercise 04 - Appending events to Emmett

Using a defined structure of events from the [first exercise](../01_events_definition/), fill a `appendToStream` function to store events in selected Emmet's event storage:

- [EventStoreDB](./eventstoredb/),
- [PostgreSQL](./postgresql/),
- [MongoDB](./mongodb)

## Prerequisities

1. Run: `docker compose up` (or for Mac `docker compose -f docker-compose.arm.yml up`) to start EventStoreDB docker image.You should automatically get:

- EventStoreDB UI: http://localhost:2113/
- Mongo Express UI: http://localhost:8081/
  - UI Credentials: login: `admin`, password: `pass`
- PgAdmin: http://localhost:5050/
  - UI Credentials: login: `admin@pgadmin.org`, password: `admin`
  - Database Credentials: host: `postgres`, login: `postgres`, password: `postgres`

2. You can get build watch by running `npm run build:ts:watch`.
3. To run test for exercises run `npm run test:exercise`. For solutions run `npm run test:solved`, for all `npm run test`.
4. Whe you're working with exercise and want to have tests running on file change run `npm run test:exercise:watch`.
