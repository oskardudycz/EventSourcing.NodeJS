import { removeSQLiteFolder, temporarySQLiteFolder } from '@e-commerce/core';
import { createApplication, type ApplicationOptions } from './application';
import {
  createModuleStores,
  type EventStoreLocation,
  type Pulling,
} from './eventStore';
import type { Settings } from './settings';

export type ApplicationDependencies = Pick<
  ApplicationOptions,
  'paymentGateway' | 'warehouse' | 'logger' | 'prices' | 'now'
> & { pulling?: Pulling };

const locationOf = (
  settings: Settings,
): { location: EventStoreLocation; removeOnStop?: string } => {
  if (settings.eventStoreType === 'postgresql')
    return {
      location: {
        type: 'postgresql',
        connectionString: settings.postgreSQLUrl,
      },
    };

  if (settings.sqliteFolder)
    return { location: { type: 'sqlite', folder: settings.sqliteFolder } };

  const folder = temporarySQLiteFolder();

  return { location: { type: 'sqlite', folder }, removeOnStop: folder };
};

export const buildApplication = (
  settings: Settings,
  { pulling, ...dependencies }: ApplicationDependencies,
) => {
  const { location, removeOnStop } = locationOf(settings);
  const stores = createModuleStores(location, settings.messagingBus, pulling);
  const application = createApplication({
    ...dependencies,
    stores,
    internalDelivery: settings.messagingInternalDelivery,
    connections: {
      kafka: {
        connection: { bootstrapBrokers: settings.kafkaBootstrapServers },
        publishTimeoutInMs: settings.kafkaPublishTimeoutInMs,
      },
      rabbitMQ: {
        connection: { url: settings.rabbitMQUrl },
        publishTimeoutInMs: settings.rabbitMQPublishTimeoutInMs,
      },
    },
    messagingRetry: { minTimeout: settings.messagingRetryInitialIntervalInMs },
    ...(settings.workersScheduled ? { workers: {} } : {}),
  });

  return {
    application,
    stores,
    sqliteFolder: location.type === 'sqlite' ? location.folder : undefined,
    start: application.start,
    stop: async () => {
      await application.stop();
      if (removeOnStop) await removeSQLiteFolder(removeOnStop);
    },
  };
};
