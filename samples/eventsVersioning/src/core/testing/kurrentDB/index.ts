import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { StartedKurrentDBContainer } from './kurrentDBContainer';
import { KurrentDBContainer } from './kurrentDBContainer';

let kurrentDBContainer: StartedKurrentDBContainer;

export const getKurrentDBTestClient = async (
  useTestContainers = false,
): Promise<KurrentDBClient> => {
  let connectionString;

  if (useTestContainers) {
    if (!kurrentDBContainer)
      kurrentDBContainer = await new KurrentDBContainer().start();

    connectionString = kurrentDBContainer.getConnectionString();
  } else {
    // await compose.upAll();
    connectionString = 'kurrentdb://localhost:2113?tls=false';
  }

  // That's how KurrentDB client is setup
  // We're taking the connection string from container
  return KurrentDBClient.connectionString(connectionString);
};
