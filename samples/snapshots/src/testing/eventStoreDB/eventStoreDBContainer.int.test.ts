import {
  EventStoreDBContainer,
  StartedEventStoreDBContainer,
} from './eventStoreDBContainer';
import { EventStoreDBClient, jsonEvent } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';

describe('EventStoreDBContainer', () => {
  jest.setTimeout(180_000);

  let container: StartedEventStoreDBContainer;

  beforeAll(async () => {
    container = await new EventStoreDBContainer().startContainer();
  });

  it('should connect to EventStoreDB and append new event', async () => {
    const connectionString = container.getConnectionString();
    const client = EventStoreDBClient.connectionString(connectionString);

    const result = await client.appendToStream(
      `test-${uuid()}`,
      jsonEvent({ type: 'test-event', data: { test: 'test' } }),
    );

    expect(result.success).toBeTruthy();
  });

  afterAll(async () => {
    await container.stop();
  });
});
