# Exercise 03 - Appending events to KurrentDB

Using a defined structure of events from the [first exercise](../01_events_definition/), fill a `appendToStream` function to store events in [KurrentDB](https://docs.kurrent.io/clients/node/).

## Prerequisites

Tests start their own KurrentDB container. To see what streams and events look like, start [docker compose](../../docker-compose.yml) from the main workshop folder (`docker compose --profile all up`, for Mac `docker compose -f docker-compose.arm.yml --profile all up`). Tests then use this KurrentDB automatically. Stop it to go back. Use KurrentDB UI to see the data. It's available at: http://localhost:2113/.
