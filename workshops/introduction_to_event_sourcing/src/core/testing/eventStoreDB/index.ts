import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from '@event-driven-io/emmett-testcontainers';
import { EventStoreDBClient } from '@eventstore/db-client';

let esdbContainer: StartedEventStoreDBContainer | undefined;
let instanceCounter = 0;

export const getEventStoreDBTestClient = async (
  useTestContainers = true,
): Promise<EventStoreDBClient> => {
  let connectionString;

  if (process.env.ES_USE_TEST_CONTAINERS !== 'false' && useTestContainers) {
    ++instanceCounter;
    if (!esdbContainer)
      esdbContainer = await new EventStoreDBContainer().start();

    connectionString = esdbContainer.getConnectionString();
  } else {
    // await compose.upAll();
    connectionString = 'esdb://localhost:2113?tls=false';
  }

  // That's how EventStoreDB client is setup
  // We're taking the connection string from container
  return EventStoreDBClient.connectionString(connectionString);
};

export const releaseEventStoreDBContainer = async () => {
  if (--instanceCounter !== 0) return;
  try {
    if (esdbContainer) {
      await esdbContainer.stop();
      esdbContainer = undefined;
    }
  } catch {
    // mute
  }
};
