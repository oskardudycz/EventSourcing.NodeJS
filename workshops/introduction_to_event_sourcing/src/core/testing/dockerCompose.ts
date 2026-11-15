import { getContainerRuntimeClient } from 'testcontainers';

const DOCKER_COMPOSE_PROJECT = 'eventsourcing';

export const dockerComposePort = async (
  service: string,
  containerPort: number,
): Promise<number | undefined> => {
  const client = await getContainerRuntimeClient();
  const containers = await client.container.list();

  return containers
    .filter(
      (container) =>
        container.Labels['com.docker.compose.project'] ===
          DOCKER_COMPOSE_PROJECT &&
        container.Labels['com.docker.compose.service'] === service,
    )
    .flatMap((container) => container.Ports)
    .find((port) => port.PrivatePort === containerPort && port.PublicPort)
    ?.PublicPort;
};
