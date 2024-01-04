import request from 'supertest';
import { App } from 'supertest/types';
import { v4 as uuid } from 'uuid';

export async function setupStartedShift(
  app: App,
  existingCashRegisterId: string,
): Promise<void> {
  await request(app)
    .post(`/cash-registers/${existingCashRegisterId}/shifts`)
    .send({ cashierId: uuid() })
    .expect(200);
}
