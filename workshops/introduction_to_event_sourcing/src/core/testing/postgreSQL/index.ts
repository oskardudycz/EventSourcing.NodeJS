import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

let postgreSQLContainer: StartedPostgreSqlContainer | undefined;
let instanceCounter = 0;

export const getPostgreSQLConnectionString = async (
  useTestContainers = true,
): Promise<string> => {
  let connectionString;

  if (process.env.ES_USE_TEST_CONTAINERS !== 'false' && useTestContainers) {
    ++instanceCounter;
    if (!postgreSQLContainer)
      postgreSQLContainer = await new PostgreSqlContainer().start();

    connectionString = postgreSQLContainer.getConnectionUri();
  } else {
    connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';
  }

  return connectionString;
};

export const releasePostgreSqlContainer = async () => {
  if (--instanceCounter !== 0) return;
  try {
    if (postgreSQLContainer) {
      await postgreSQLContainer.stop();
      postgreSQLContainer = undefined;
    }
  } catch {
    // mute
  }
};
