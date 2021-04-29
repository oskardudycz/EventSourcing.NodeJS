import { EventStoreDBClient, jsonEvent } from '@eventstore/db-client';

describe('cashier', () => {
  it('should store snapshot in the same process', async () => {
    const client = EventStoreDBClient.connectionString(
      'esdb://127.0.0.1:2113?tls=false'
    );

    const event = jsonEvent({ type: 'sth', data: { sth: 'ddd' } });

    const result = await client.appendToStream('some-stream', event);

    expect(result.success).toBeTruthy();
  });
});
