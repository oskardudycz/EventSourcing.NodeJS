import { EventStoreDBClient, jsonEvent } from '@eventstore/db-client';
import { v4 as uuid } from 'uuid';

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

describe('cashier', () => {
  it.skip('should store snapshot in the same process', async () => {
    const client = EventStoreDBClient.connectionString(
      'esdb://127.0.0.1:2113?tls=false&throwOnAppendFailure=false',
    );

    const number = '1007';
    const orderId = `order-${number}`;
    const emailId = `email-${number}`;
    const shipmentId = `shipment-${number}`;

    const orderPlaced = jsonEvent({
      id: uuid(),
      type: 'OrderPlaced',
      data: { product_id: 'LICENSE_KEY_1337', user_id: 439 },
      metadata: {
        $correlationId: orderId,
      },
    });
    const paymentMade = jsonEvent({
      id: uuid(),
      type: 'PaymentMade',
      data: { product_id: 'LICENSE_KEY_1337', user_id: 439 },
      metadata: {
        $correlationId: orderId,
        $causedBy: orderPlaced.id,
      },
    });
    const orderCompleted = jsonEvent({
      id: uuid(),
      type: 'OrderCompleted',
      data: { product_id: 'LICENSE_KEY_1337', user_id: 439 },
      metadata: {
        $correlationId: orderId,
        $causedBy: paymentMade.id,
      },
    });

    let result = await client.appendToStream(orderId, [orderPlaced]);
    await delay(100);
    result = await client.appendToStream(orderId, [paymentMade]);
    await delay(100);
    result = await client.appendToStream(orderId, [orderCompleted]);

    expect(result.success).toBeTruthy();

    const emailSent = jsonEvent({
      id: uuid(),
      type: 'EmailSent',
      data: { user_id: 439 },
      metadata: {
        $correlationId: orderId,
        $causedBy: orderCompleted.id,
      },
    });

    await delay(300);
    const result2 = await client.appendToStream(emailId, [emailSent]);
    expect(result2.success).toBeTruthy();

    const orderShipped = jsonEvent({
      id: uuid(),
      type: 'OrderShipped',
      data: { orderId },
      metadata: {
        $correlationId: orderId,
        $causedBy: orderCompleted.id,
      },
    });

    await delay(500);
    const result3 = await client.appendToStream(shipmentId, [orderShipped]);

    expect(result3.success).toBeTruthy();
  });
});
