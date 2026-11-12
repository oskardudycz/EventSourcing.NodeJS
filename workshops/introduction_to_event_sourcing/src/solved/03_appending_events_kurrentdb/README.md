# Exercise 03 - Appending events to KurrentDB

Using a defined structure of events from the [first exercise](../01_events_definition/), fill a `appendToStream` function to store events in [KurrentDB](https://docs.kurrent.io/clients/node/).

## Prerequisites

Run [docker compose](../../../docker-compose.yml) script from the main workshop repository to start KurrentDB instance.

```shell
docker compose up
```

or for Mac:

```shell
docker compose -f docker-compose.arm.yml up
```

After that you can use KurrentDB UI to see how streams and events look like. It's available at: http://localhost:2113/.

## Solution

Use [Append events KurrentDB API](https://docs.kurrent.io/clients/node/v1.3/appending-events.html).
